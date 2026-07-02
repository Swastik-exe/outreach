# syntax=docker/dockerfile:1
# Multi-stage build: compile with the full JDK, run on a slim JRE.
# Render builds this directly from the repo (see render.yaml) — no external registry needed.

# ---- Build stage ------------------------------------------------------------
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app

# Cache Maven deps in their own layer — only re-downloaded when pom.xml changes.
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -B dependency:go-offline

# CACHEBUST: bump this if a build ever looks stale (e.g. Render reusing an old
# layer) — it forces the COPY below to re-run even when src/ content looks
# unchanged to a shallow cache check. Normal content changes already
# invalidate COPY's cache correctly on their own; this is a manual escape
# hatch, not the primary caching mechanism.
ARG CACHEBUST=5
COPY src/ src/
RUN ./mvnw -B clean package -DskipTests

# ---- Runtime stage -----------------------------------------------------------
FROM eclipse-temurin:21-jre-alpine AS runtime
WORKDIR /app

# Non-root user — containers should never run as root.
RUN addgroup -S spring && adduser -S spring -G spring
COPY --from=build /app/target/*.jar app.jar
RUN chown spring:spring app.jar
USER spring

# Render (and most PaaS) inject PORT at runtime; default 8080 for local `docker run`.
EXPOSE 8080
ENTRYPOINT ["sh", "-c", "java -XX:+UseContainerSupport -XX:MaxRAMPercentage=75 -Dserver.port=${PORT:-8080} -jar app.jar"]
