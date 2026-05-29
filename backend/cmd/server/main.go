package main

import (
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"
	"github.com/namchok/mapbox-learning/internal/handlers"
	"github.com/namchok/mapbox-learning/internal/mapbox"
	"github.com/namchok/mapbox-learning/internal/services"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("no .env file, reading from environment")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	mapboxToken := os.Getenv("MAPBOX_SECRET_TOKEN")
	if mapboxToken == "" {
		log.Fatal("MAPBOX_SECRET_TOKEN is required")
	}

	mapboxClient := mapbox.NewClient(mapboxToken)
	directionsService := services.NewDirectionsService(mapboxClient)
	directionsHandler := handlers.NewDirectionsHandler(directionsService)

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Use(cors.Handler(cors.Options{
		// Dev CORS: allow local frontend hosts/ports without opening public wildcard access.
		AllowOriginFunc: func(r *http.Request, origin string) bool {
			return origin == "" ||
				strings.HasPrefix(origin, "http://localhost:") ||
				strings.HasPrefix(origin, "http://127.0.0.1:") ||
				strings.HasPrefix(origin, "http://192.168.") ||
				strings.HasPrefix(origin, "http://10.") ||
				strings.HasPrefix(origin, "http://172.")
		},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Content-Type", "Authorization"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	r.Route("/api", func(api chi.Router) {
		api.Get("/health", handlers.Health)
		api.Get("/directions", directionsHandler.GetDirections)
	})

	log.Printf("server listening on :%s", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatal(err)
	}
}
