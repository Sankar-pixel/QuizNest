# services/multiplayer-go/Dockerfile
FROM golang:1.22-alpine AS build

WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY main.go ./
RUN go build -o multiplayer-server main.go

FROM alpine:3.20
WORKDIR /app
COPY --from=build /app/multiplayer-server .

EXPOSE 8080
CMD ["./multiplayer-server"]
