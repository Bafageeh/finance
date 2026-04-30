#!/usr/bin/env bash
set -Eeuo pipefail

# Create a second Finance instance with the same code and a different MySQL database.
#
# Safe defaults for the current server layout:
#   source app : /home/pmsa/apps/finance
#   target app : /home/pmsa/apps/finance-copy
#   api path   : finance-api
#
# Example:
#   chmod +x scripts/create-finance-mysql-copy.sh
#   TARGET_NAME=finance-test \
#   DB_DATABASE=finance_test \
#   DB_USERNAME=finance_test \
#   DB_PASSWORD='StrongPasswordHere' \
#   APP_URL='https://finance-test.example.com' \
#   FINANCE_ADMIN_EMAIL='admin@pm.sa' \
#   FINANCE_ADMIN_PASSWORD='123456' \
#   bash scripts/create-finance-mysql-copy.sh
#
# Optional: COPY_DATA=1 copies the source MySQL database data into the new database.

BASE_DIR="${BASE_DIR:-/home/pmsa/apps}"
SOURCE_APP="${SOURCE_APP:-$BASE_DIR/finance}"
TARGET_NAME="${TARGET_NAME:-finance-copy}"
TARGET_APP="${TARGET_APP:-$BASE_DIR/$TARGET_NAME}"
API_DIR_NAME="${API_DIR_NAME:-finance-api}"

APP_URL="${APP_URL:-http://localhost}"
DB_CONNECTION="${DB_CONNECTION:-mysql}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_DATABASE="${DB_DATABASE:-${TARGET_NAME//-/_}}"
DB_USERNAME="${DB_USERNAME:-${DB_DATABASE}_user}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_GRANT_HOST="${DB_GRANT_HOST:-localhost}"

MYSQL_ADMIN_USER="${MYSQL_ADMIN_USER:-root}"
MYSQL_ADMIN_PASSWORD="${MYSQL_ADMIN_PASSWORD:-}"
MYSQL_ADMIN_HOST="${MYSQL_ADMIN_HOST:-localhost}"
MYSQL_ADMIN_PORT="${MYSQL_ADMIN_PORT:-3306}"

COPY_DATA="${COPY_DATA:-0}"
FINANCE_ADMIN_NAME="${FINANCE_ADMIN_NAME:-مدير النظام}"
FINANCE_ADMIN_EMAIL="${FINANCE_ADMIN_EMAIL:-admin@pm.sa}"
FINANCE_ADMIN_PASSWORD="${FINANCE_ADMIN_PASSWORD:-}"
MOBILE_API_URL="${MOBILE_API_URL:-$APP_URL}"

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

mysql_admin() {
  local args=(mysql -u "$MYSQL_ADMIN_USER" -h "$MYSQL_ADMIN_HOST" -P "$MYSQL_ADMIN_PORT")
  if [[ -n "$MYSQL_ADMIN_PASSWORD" ]]; then
    args+=("-p$MYSQL_ADMIN_PASSWORD")
  fi
  "${args[@]}" "$@"
}

mysql_user_cmd() {
  local args=(mysql -u "$DB_USERNAME" -h "$DB_HOST" -P "$DB_PORT")
  if [[ -n "$DB_PASSWORD" ]]; then
    args+=("-p$DB_PASSWORD")
  fi
  "${args[@]}" "$@"
}

sql_escape() {
  printf "%s" "$1" | sed "s/'/''/g"
}

set_env() {
  local file="$1"
  local key="$2"
  local value="$3"
  local escaped
  escaped=$(printf '%s' "$value" | sed -e 's/[\\&]/\\&/g')
  if grep -qE "^${key}=" "$file"; then
    sed -i "s|^${key}=.*|${key}=${escaped}|" "$file"
  else
    printf '\n%s=%s\n' "$key" "$value" >> "$file"
  fi
}

get_env_value() {
  local file="$1"
  local key="$2"
  grep -E "^${key}=" "$file" | tail -n 1 | cut -d '=' -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

quote_env() {
  local value="$1"
  printf '"%s"' "${value//\"/\\\"}"
}

if [[ ! -d "$SOURCE_APP" ]]; then
  echo "Source app not found: $SOURCE_APP" >&2
  exit 1
fi

if [[ ! -d "$SOURCE_APP/$API_DIR_NAME" ]]; then
  echo "Source API directory not found: $SOURCE_APP/$API_DIR_NAME" >&2
  exit 1
fi

if [[ -e "$TARGET_APP" ]]; then
  echo "Target already exists: $TARGET_APP" >&2
  echo "Choose another TARGET_NAME or remove the existing folder first." >&2
  exit 1
fi

need_cmd rsync
need_cmd php
need_cmd mysql
need_cmd composer

if [[ -z "$DB_PASSWORD" ]]; then
  if command -v openssl >/dev/null 2>&1; then
    DB_PASSWORD="$(openssl rand -hex 18)"
  else
    DB_PASSWORD="$(date +%s | sha256sum | cut -c1-36)"
  fi
fi

echo "Creating MySQL database: $DB_DATABASE"
DB_DATABASE_SQL=$(sql_escape "$DB_DATABASE")
DB_USERNAME_SQL=$(sql_escape "$DB_USERNAME")
DB_PASSWORD_SQL=$(sql_escape "$DB_PASSWORD")
DB_GRANT_HOST_SQL=$(sql_escape "$DB_GRANT_HOST")
mysql_admin <<SQL
CREATE DATABASE IF NOT EXISTS \`$DB_DATABASE_SQL\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DB_USERNAME_SQL'@'$DB_GRANT_HOST_SQL' IDENTIFIED BY '$DB_PASSWORD_SQL';
ALTER USER '$DB_USERNAME_SQL'@'$DB_GRANT_HOST_SQL' IDENTIFIED BY '$DB_PASSWORD_SQL';
GRANT ALL PRIVILEGES ON \`$DB_DATABASE_SQL\`.* TO '$DB_USERNAME_SQL'@'$DB_GRANT_HOST_SQL';
FLUSH PRIVILEGES;
SQL

echo "Copying app from $SOURCE_APP to $TARGET_APP"
mkdir -p "$(dirname "$TARGET_APP")"
rsync -a \
  --exclude='.git' \
  --exclude="$API_DIR_NAME/vendor" \
  --exclude="$API_DIR_NAME/node_modules" \
  --exclude="$API_DIR_NAME/storage/logs/*" \
  --exclude="$API_DIR_NAME/bootstrap/cache/*.php" \
  "$SOURCE_APP/" "$TARGET_APP/"

API_DIR="$TARGET_APP/$API_DIR_NAME"
cd "$API_DIR"

if [[ ! -f .env ]]; then
  if [[ -f .env.example ]]; then
    cp .env.example .env
  else
    touch .env
  fi
fi

set_env .env APP_NAME "$(quote_env "$TARGET_NAME")"
set_env .env APP_ENV production
set_env .env APP_DEBUG false
set_env .env APP_URL "$APP_URL"
set_env .env DB_CONNECTION "$DB_CONNECTION"
set_env .env DB_HOST "$DB_HOST"
set_env .env DB_PORT "$DB_PORT"
set_env .env DB_DATABASE "$DB_DATABASE"
set_env .env DB_USERNAME "$DB_USERNAME"
set_env .env DB_PASSWORD "$DB_PASSWORD"
set_env .env SESSION_DRIVER database
set_env .env CACHE_STORE database
set_env .env QUEUE_CONNECTION database
set_env .env FINANCE_ADMIN_NAME "$(quote_env "$FINANCE_ADMIN_NAME")"
set_env .env FINANCE_ADMIN_EMAIL "$FINANCE_ADMIN_EMAIL"
if [[ -n "$FINANCE_ADMIN_PASSWORD" ]]; then
  set_env .env FINANCE_ADMIN_PASSWORD "$FINANCE_ADMIN_PASSWORD"
fi

if [[ "$COPY_DATA" == "1" ]]; then
  SOURCE_ENV="$SOURCE_APP/$API_DIR_NAME/.env"
  if [[ ! -f "$SOURCE_ENV" ]]; then
    echo "COPY_DATA=1 requested, but source .env was not found: $SOURCE_ENV" >&2
    exit 1
  fi

  SOURCE_DB_CONNECTION="$(get_env_value "$SOURCE_ENV" DB_CONNECTION || true)"
  SOURCE_DB_HOST="$(get_env_value "$SOURCE_ENV" DB_HOST || true)"
  SOURCE_DB_PORT="$(get_env_value "$SOURCE_ENV" DB_PORT || true)"
  SOURCE_DB_DATABASE="$(get_env_value "$SOURCE_ENV" DB_DATABASE || true)"
  SOURCE_DB_USERNAME="$(get_env_value "$SOURCE_ENV" DB_USERNAME || true)"
  SOURCE_DB_PASSWORD="$(get_env_value "$SOURCE_ENV" DB_PASSWORD || true)"

  if [[ "$SOURCE_DB_CONNECTION" != "mysql" ]]; then
    echo "COPY_DATA supports MySQL source only. Source DB_CONNECTION=$SOURCE_DB_CONNECTION" >&2
    exit 1
  fi

  need_cmd mysqldump
  echo "Copying data from source database: $SOURCE_DB_DATABASE"
  dump_args=(mysqldump -u "$SOURCE_DB_USERNAME" -h "${SOURCE_DB_HOST:-localhost}" -P "${SOURCE_DB_PORT:-3306}" --single-transaction --quick --routines --triggers "$SOURCE_DB_DATABASE")
  if [[ -n "$SOURCE_DB_PASSWORD" ]]; then
    dump_args+=("-p$SOURCE_DB_PASSWORD")
  fi
  "${dump_args[@]}" | mysql_user_cmd "$DB_DATABASE"
fi

echo "Installing API dependencies and preparing Laravel"
composer install --no-dev --optimize-autoloader --no-interaction
php artisan key:generate --force
php artisan migrate --force
php artisan optimize:clear
php artisan config:cache

if [[ -n "$FINANCE_ADMIN_PASSWORD" ]]; then
  echo "Creating/updating admin user: $FINANCE_ADMIN_EMAIL"
  FINANCE_ADMIN_NAME="$FINANCE_ADMIN_NAME" \
  FINANCE_ADMIN_EMAIL="$FINANCE_ADMIN_EMAIL" \
  FINANCE_ADMIN_PASSWORD="$FINANCE_ADMIN_PASSWORD" \
  php artisan tinker --execute='\
$name = getenv("FINANCE_ADMIN_NAME") ?: "Admin";\
$email = getenv("FINANCE_ADMIN_EMAIL") ?: "admin@pm.sa";\
$password = getenv("FINANCE_ADMIN_PASSWORD");\
if ($password) {\
    $user = App\\Models\\User::firstOrCreate(["email" => $email], ["name" => $name, "password" => Illuminate\\Support\\Facades\\Hash::make($password)]);\
    $user->name = $name;\
    $user->password = Illuminate\\Support\\Facades\\Hash::make($password);\
    $user->save();\
    echo "Admin ready: {$email}".PHP_EOL;\
}\
'
fi

# Best-effort: update common frontend/mobile .env files if they exist.
if [[ -n "$MOBILE_API_URL" ]]; then
  while IFS= read -r env_file; do
    case "$env_file" in
      "$API_DIR/.env") continue ;;
    esac
    set_env "$env_file" EXPO_PUBLIC_API_URL "$MOBILE_API_URL"
    set_env "$env_file" API_URL "$MOBILE_API_URL"
    set_env "$env_file" VITE_API_URL "$MOBILE_API_URL"
    set_env "$env_file" REACT_APP_API_URL "$MOBILE_API_URL"
  done < <(find "$TARGET_APP" -maxdepth 4 -type f \( -name '.env' -o -name '.env.*' \))
fi

cat <<EOF

Done.
New Finance instance path: $TARGET_APP
API path: $API_DIR
Database: $DB_DATABASE
DB user: $DB_USERNAME
DB password: $DB_PASSWORD

Next steps:
1) Point the new domain/subdomain to: $TARGET_APP or $API_DIR depending on your web-server setup.
2) Make sure the web root for Laravel points to: $API_DIR/public
3) If you have a separate mobile/web build, point it to the new API URL: $APP_URL
EOF
