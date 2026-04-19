start the backend

lsof -ti:8080 | xargs kill -9; cd /Users/frankbaier/projects/familyadmin/backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
