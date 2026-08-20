#!/bin/bash
(cd backend && npm start) &
(cd admin && npx expo start --web --port 8082) &
(cd frontend && npx expo start --web --port 8081) &
wait
