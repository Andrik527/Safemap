#!/bin/sh
set -e
cd /var/www/html

# SQLite (solo se usa si DB_CONNECTION=sqlite)
mkdir -p database
[ -f database/database.sqlite ] || touch database/database.sqlite

# Carpeta de fotos + permisos
mkdir -p storage/app/public/incidents
chown -R www-data:www-data database storage bootstrap/cache

# Enlace public/storage -> storage/app/public (para que las fotos sean accesibles por URL)
php artisan storage:link --force || true

# Migraciones con reintentos: PostgreSQL puede tardar unos segundos en aceptar conexiones
attempt=1
until su -s /bin/sh www-data -c "php artisan migrate --force"; do
  if [ "$attempt" -ge 10 ]; then
    echo "No se pudo ejecutar la migración tras $attempt intentos. Revisa DB_* en Render."
    exit 1
  fi
  echo "Migración falló (intento $attempt). Reintentando en 5 s..."
  attempt=$((attempt + 1))
  sleep 5
done

# Inicia Apache como proceso principal
exec apache2-foreground

# Limpiar cachés trabadas
php artisan route:clear
php artisan config:clear
# Ejecutar migraciones en PostgreSQL automáticamente
php artisan migrate --force