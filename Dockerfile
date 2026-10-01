FROM eclipse-temurin:21-jdk-alpine
WORKDIR /app
COPY Server.java .
RUN javac Server.java
EXPOSE 5000
CMD ["java", "Server"]
