echo "🔄 You need tyk CLI Set up..."

echo "🔄 Starting loading apis..."
tyk api import-oas -f accounts-and-transaction.yaml
tyk api import-oas -f event-dispatcher.yaml
tyk api import-oas -f event-notification-api-specification.yaml
tyk api import-oas -f event-notification-forwarder.yaml
tyk api import-oas -f events-api-specification.yaml
tyk api import-oas -f payment-initiation-api.yaml
echo "✅ APIs Loaded"
