#!/usr/bin/env python3
"""
Imports notes exported by export_apple_notes.applescript into FamilyAdmin,
preserving the real Apple Notes folder hierarchy.

Mapping:
  - Each top-level Apple Notes folder (directly under an account, e.g.
    "Reisen") becomes a FamilyAdmin category (reused if one with the same
    name already exists).
  - Each nested subfolder (e.g. "Reisen" > "2023 Amsterdam") becomes a node
    in the tree, nested the same way.
  - Each note becomes a node under the folder it lives in (category root,
    or the corresponding subfolder node).
  - Folders/subtrees with zero notes anywhere inside them are skipped.
  - "Recently Deleted" is always skipped.

Safe to interrupt and re-run: before creating anything, existing
categories/nodes at each spot are looked up by name and reused rather than
duplicated, so a re-run only creates what's still missing.

Usage:
    python3 import_apple_notes.py --email frank.baier@gmx.ch --api-url https://your-domain

Password is read from the FAMILYADMIN_PASSWORD env var if set, otherwise
prompted for interactively (not echoed, never logged).
"""

import argparse
import getpass
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

CATEGORY_NAME_MAX = 100
NODE_NAME_MAX = 255
SKIP_FOLDER_NAMES = {"recently deleted"}
REQUEST_TIMEOUT = 20  # seconds — fail fast on a stalled connection instead of hanging forever


def api_call(api_url, path, token=None, method="GET", body=None):
    url = f"{api_url}{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            detail = json.loads(raw)
        except (json.JSONDecodeError, ValueError):
            detail = raw.decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {path} -> HTTP {e.code}: {detail}") from None
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        raise RuntimeError(f"{method} {path} -> connection problem: {e}") from None


def login(api_url, email, password):
    result = api_call(api_url, "/api/auth/login", method="POST", body={"email": email, "password": password})
    return result["accessToken"]


def get_or_create_category(api_url, token, name, cache):
    key = name.strip().lower()
    if key in cache:
        return cache[key]

    existing = api_call(api_url, "/api/notes/categories", token=token)
    for cat in existing:
        if cat["name"].strip().lower() == key:
            cache[key] = cat["id"]
            return cat["id"]

    created = api_call(api_url, "/api/notes/categories", token=token, method="POST", body={"name": name})
    cache[key] = created["id"]
    return created["id"]


def create_node(api_url, token, category_id, name, content, parent_id=None):
    return api_call(
        api_url,
        f"/api/notes/categories/{category_id}/nodes",
        token=token,
        method="POST",
        body={"name": name, "content": content, "parentId": parent_id},
    )


def delete_all_categories(api_url, token):
    categories = api_call(api_url, "/api/notes/categories", token=token)
    for cat in categories:
        api_call(api_url, f"/api/notes/categories/{cat['id']}", token=token, method="DELETE")
    print(f"Deleted {len(categories)} existing categories.")


def build_folder_tree(folders):
    by_id = {f["id"]: f for f in folders}
    children = {}
    roots = []
    for f in folders:
        parent = f.get("parentFolderId")
        if parent and parent in by_id:
            children.setdefault(parent, []).append(f)
        else:
            roots.append(f)
    return roots, children


def count_notes_in_subtree(folder, children, cache):
    if folder["id"] in cache:
        return cache[folder["id"]]
    total = len(folder["notes"])
    for child in children.get(folder["id"], []):
        total += count_notes_in_subtree(child, children, cache)
    cache[folder["id"]] = total
    return total


def node_key(parent_id, name):
    return (parent_id, name.strip().lower())


def get_or_create_node(api_url, token, category_id, name, content, parent_id, existing_index, stats):
    key = node_key(parent_id, name)
    if key in existing_index:
        stats["skipped"] += 1
        print(".", end="", flush=True)
        return existing_index[key]

    node = create_node(api_url, token, category_id, name, content, parent_id)
    existing_index[key] = node["id"]
    stats["imported"] += 1
    print(".", end="", flush=True)
    return node["id"]


def import_folder_contents(api_url, token, category_id, folder, children, subtree_counts, parent_node_id, existing_index, stats):
    for note in folder["notes"]:
        title = (note["title"] or "Untitled").strip()[:NODE_NAME_MAX] or "Untitled"
        body = note.get("body") or ""
        try:
            get_or_create_node(api_url, token, category_id, title, body, parent_node_id, existing_index, stats)
        except RuntimeError as e:
            print(f"\n  [FAILED note] {title}: {e}")
            stats["failed"].append((folder["name"], title))

    for child in children.get(folder["id"], []):
        if subtree_counts.get(child["id"], 0) == 0:
            continue
        child_name = (child["name"] or "Untitled").strip()[:NODE_NAME_MAX] or "Untitled"
        try:
            child_node_id = get_or_create_node(api_url, token, category_id, child_name, None, parent_node_id, existing_index, stats)
        except RuntimeError as e:
            print(f"\n  [FAILED subfolder] {child_name}: {e}")
            stats["failed"].append((folder["name"], f"(subfolder) {child_name}"))
            continue
        import_folder_contents(api_url, token, category_id, child, children, subtree_counts, child_node_id, existing_index, stats)


def run(api_url, email, password, export_file, replace_existing):
    with open(export_file, "r", encoding="utf-8") as f:
        folders = json.load(f)

    token = login(api_url, email, password)
    print(f"Logged in as {email}")

    if replace_existing:
        delete_all_categories(api_url, token)

    roots, children = build_folder_tree(folders)
    subtree_counts = {}
    for f in folders:
        count_notes_in_subtree(f, children, subtree_counts)

    category_cache = {}
    stats = {"imported": 0, "skipped": 0, "failed": []}
    total_notes = sum(len(f["notes"]) for f in folders)

    for root in roots:
        if root["name"].strip().lower() in SKIP_FOLDER_NAMES:
            continue
        if subtree_counts.get(root["id"], 0) == 0:
            continue

        category_name = (root["name"] or "Notizen").strip()[:CATEGORY_NAME_MAX] or "Notizen"
        try:
            category_id = get_or_create_category(api_url, token, category_name, category_cache)
            existing_nodes = api_call(api_url, f"/api/notes/categories/{category_id}/nodes", token=token)
        except RuntimeError as e:
            print(f"[SKIP CATEGORY] {category_name}: {e}")
            continue

        existing_index = {node_key(n["parentId"], n["name"]): n["id"] for n in existing_nodes}

        print(f"Category '{category_name}' ", end="", flush=True)
        import_folder_contents(api_url, token, category_id, root, children, subtree_counts, None, existing_index, stats)
        print()

    print()
    print(f"Imported {stats['imported']} new, skipped {stats['skipped']} already present (of {total_notes} notes total).")
    if stats["failed"]:
        print(f"{len(stats['failed'])} failed:")
        for folder_name, title in stats["failed"]:
            print(f"  - {folder_name} / {title}")
        print("Re-run the script to retry — already-imported notes will be skipped automatically.")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--file", default="~/Desktop/apple_notes_export.json", help="Path to the exported JSON file")
    parser.add_argument("--api-url", default="http://localhost:8080", help="FamilyAdmin backend base URL")
    parser.add_argument("--email", required=True, help="FamilyAdmin login email")
    parser.add_argument(
        "--replace-existing",
        action="store_true",
        help="Delete ALL of your existing note categories before importing (only use for a truly fresh start — normally just re-run without this flag to resume)",
    )
    args = parser.parse_args()

    export_file = Path(args.file).expanduser()
    if not export_file.exists():
        print(f"Export file not found: {export_file}", file=sys.stderr)
        print("Run export_apple_notes.applescript first (osascript export_apple_notes.applescript).", file=sys.stderr)
        sys.exit(1)

    password = os.environ.get("FAMILYADMIN_PASSWORD") or getpass.getpass(f"Password for {args.email}: ")

    if args.replace_existing:
        confirm = input("This will DELETE ALL your existing FamilyAdmin note categories first. Type 'yes' to continue: ")
        if confirm.strip().lower() != "yes":
            print("Aborted.")
            sys.exit(1)

    try:
        run(args.api_url.rstrip("/"), args.email, password, export_file, args.replace_existing)
    except RuntimeError as e:
        print(f"\nError: {e}", file=sys.stderr)
        print("Safe to just re-run the same command — already-imported notes will be skipped.", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
