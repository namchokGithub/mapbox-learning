package handlers

import (
	"encoding/json"
	"net/http"
	"time"
)

type healthResponse struct {
	Status    string `json:"status"`
	Timestamp string `json:"timestamp"`
}

func Health(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(healthResponse{
		Status:    "ok",
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	})
}
