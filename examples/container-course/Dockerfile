# syntax=docker/dockerfile:1
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY src/ContainerCourse.Api/ContainerCourse.Api.csproj src/ContainerCourse.Api/
RUN dotnet restore src/ContainerCourse.Api/ContainerCourse.Api.csproj
COPY . .
RUN dotnet publish src/ContainerCourse.Api/ContainerCourse.Api.csproj \
    --configuration Release --no-restore --output /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
COPY --from=build --chown=$APP_UID:$APP_UID /app/publish .
USER $APP_UID
ENTRYPOINT ["dotnet", "ContainerCourse.Api.dll"]
