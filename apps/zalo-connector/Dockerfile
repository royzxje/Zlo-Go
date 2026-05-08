FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN go build -o /out/zalo-connector ./cmd/connector

FROM alpine:3.20
WORKDIR /app
COPY --from=build /out/zalo-connector /app/zalo-connector
CMD ["/app/zalo-connector"]
