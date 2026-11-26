export type MockStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE';

export interface MockTask {
  id: string;
  title: string;
  status: MockStatus;
  assignee: string | null;
  avatarColor: string;
  dueLabel: string | null;
  overdue: boolean;
  dueToday: boolean;
  checklistDone: number;
  checklistTotal: number;
}

export const MOCK_TASKS: MockTask[] = [
  { id: '1', title: 'Book dentist appointment for the kids', status: 'OPEN', assignee: 'Sarah', avatarColor: '#E63946', dueLabel: 'Jun 20', overdue: true, dueToday: false, checklistDone: 1, checklistTotal: 3 },
  { id: '2', title: 'Fix the leaking kitchen faucet', status: 'IN_PROGRESS', assignee: 'Frank', avatarColor: '#4F46E5', dueLabel: 'Today', overdue: false, dueToday: true, checklistDone: 0, checklistTotal: 0 },
  { id: '3', title: 'Order summer clothes for Max', status: 'OPEN', assignee: 'Sarah', avatarColor: '#E63946', dueLabel: 'Jul 1', overdue: false, dueToday: false, checklistDone: 1, checklistTotal: 2 },
  { id: '4', title: 'Plan birthday party for Anna', status: 'OPEN', assignee: null, avatarColor: '', dueLabel: 'Jul 15', overdue: false, dueToday: false, checklistDone: 0, checklistTotal: 5 },
  { id: '5', title: 'Renew car insurance', status: 'DONE', assignee: 'Frank', avatarColor: '#4F46E5', dueLabel: null, overdue: false, dueToday: false, checklistDone: 0, checklistTotal: 0 },
  { id: '6', title: 'Schedule parent-teacher meeting', status: 'OPEN', assignee: 'Frank', avatarColor: '#4F46E5', dueLabel: 'Jun 30', overdue: false, dueToday: false, checklistDone: 0, checklistTotal: 0 },
  { id: '7', title: 'Water the balcony plants', status: 'IN_PROGRESS', assignee: 'Anna', avatarColor: '#059669', dueLabel: null, overdue: false, dueToday: false, checklistDone: 0, checklistTotal: 0 },
];

export const VARIANTS = [
  { id: 1, name: 'Bulletin', sub: 'Editorial serif' },
  { id: 2, name: 'Circuit', sub: 'Terminal dark' },
  { id: 3, name: 'Sticky', sub: 'Pastel playful' },
  { id: 4, name: 'Blueprint', sub: 'Bauhaus bold' },
  { id: 5, name: 'Obsidian', sub: 'Dark luxury' },
];
