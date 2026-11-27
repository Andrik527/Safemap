FROM php:8.3-apache

# Extensiones: GD con soporte JPEG/WebP (necesario para procesar las fotos de evidencia),
# SQLite y PostgreSQL
RUN apt-get update && apt-get install -y \
    libpng-dev libjpeg-dev libwebp-dev libfreetype6-dev \
    libonig-dev libxml2-dev zip unzip git libsqlite3-dev libpq-dev \
    && docker-php-ext-configure gd --with-jpeg --with-webp --with-freetype \
    && docker-php-ext-install pdo_mysql pdo_sqlite pdo_pgsql mbstring exif pcntl bcmath gd

# Configurar el directorio de trabajo
WORKDIR /var/www/html

# Copiar archivos del proyecto
COPY . .

# Instalar Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# IMPORTANTE: Evitar scripts automáticos de artisan durante la compilación
RUN composer install --no-dev --optimize-autoloader --no-scripts

# Habilitar mod_rewrite y ajustar la raíz a /public
RUN a2enmod rewrite
ENV APACHE_DOCUMENT_ROOT /var/www/html/public
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/conf-available/*.conf

# Límites de subida de archivos (por defecto PHP solo permite 2 MB)
COPY docker/uploads.ini /usr/local/etc/php/conf.d/uploads.ini

# Base de datos temporal, carpeta de fotos y permisos
RUN mkdir -p database storage/app/public/incidents && touch database/database.sqlite
RUN chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache /var/www/html/database

# Script de arranque: migraciones + enlace storage + Apache
COPY docker/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh \
    && chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 80
CMD ["docker-entrypoint.sh"]
