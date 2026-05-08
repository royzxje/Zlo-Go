package main

import (
	"context"
	"errors"
	"log"
	"os"
	"strings"
	"time"

	"github.com/royzxje/zlo-go/apps/zalo-connector/internal/runtime"
	"github.com/royzxje/zlo-go/apps/zalo-connector/internal/zalo"
)

type Config struct {
	RedisURL string
	ZaloIMEI string
}

func ConfigFromEnv() Config {
	return Config{
		RedisURL: strings.TrimSpace(os.Getenv("REDIS_URL")),
		ZaloIMEI: strings.TrimSpace(os.Getenv("ZALO_IMEI")),
	}
}

func ValidateConfig(config Config) error {
	if config.RedisURL == "" {
		return errors.New("REDIS_URL is required to start the Zalo connector")
	}
	if config.ZaloIMEI == "" {
		return errors.New("ZALO_IMEI is required to start the Zalo connector")
	}
	return nil
}

func main() {
	config := ConfigFromEnv()
	if err := ValidateConfig(config); err != nil {
		log.Printf("zalo connector not started: %v", err)
		return
	}

	redisClient, err := runtime.NewRedisClient(config.RedisURL)
	if err != nil {
		log.Fatalf("failed to initialize Redis client: %v", err)
	}
	defer redisClient.Close()

	zaloClient, err := zalo.NewZagoClient(zalo.Config{IMEI: config.ZaloIMEI})
	if err != nil {
		log.Fatalf("failed to initialize Zalo client: %v", err)
	}

	runner := runtime.NewRedisStreamRunner(redisClient, runtime.NewCommandHandler(zaloClient))
	log.Println("zalo connector consuming Redis commands")
	for {
		if err := runner.ProcessOne(context.Background()); err != nil {
			if errors.Is(err, runtime.ErrNoStreamEntry) {
				continue
			}
			log.Printf("zalo connector command processing failed: %v", err)
			time.Sleep(time.Second)
		}
	}
}
