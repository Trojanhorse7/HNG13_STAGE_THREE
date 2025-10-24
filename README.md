# Country Currency & Exchange API

A RESTful API that fetches country data from external APIs, stores it in a MySQL database, and provides CRUD operations.

## Features

- Fetch country data from REST Countries API
- Fetch exchange rates from Open Exchange Rates API
- Compute estimated GDP based on population and exchange rates
- Store data in MySQL using Prisma ORM
- CRUD operations for countries
- Image generation for summary statistics
- Comprehensive error handling and validation

## Prerequisites

- Node.js (v18 or higher)
- MySQL database
- Yarn package manager

## Setup

1. **install dependencies:**
   ```bash
   yarn install
   ```

2. **Database Setup:**
   - Create a MySQL database
   - Update `.env` with your database credentials:
   ```env
   DATABASE_URL="mysql://username:password@localhost:3306/country_api"
   PORT=3000
   ```

3. **Run Database Migrations:**
   ```bash
   yarn prisma:migrate
   yarn prisma:generate
   ```

4. **Start the Server:**
   ```bash
   yarn dev  # Development mode
   yarn start  # Production mode
   ```

## API Endpoints

### Refresh Data
- `POST /countries/refresh` - Fetch and cache country data from external APIs

### Get Countries
- `GET /countries` - Get all countries
  - Query params: `?region=Africa&currency=NGN&sort=gdp_desc`

### Country Operations
- `GET /countries/:name` - Get specific country by name
- `DELETE /countries/:name` - Delete country by name (case-insensitive)

### Status & Image
- `GET /status` - Get total countries and last refresh timestamp
- `GET /countries/image` - Serve generated summary PNG image

## Sample Responses

### GET /countries?region=Africa
```json
[
   {
      "id": 1,
      "name": "Nigeria",
      "capital": "Abuja",
      "region": "Africa",
      "population": 206139589,
      "currency_code": "NGN",
      "exchange_rate": 1600.23,
      "estimated_gdp": 25767448125.2,
      "flag_url": "https://flagcdn.com/ng.svg",
      "last_refreshed_at": "2025-10-22T18:00:00Z"
   }
]
```

### GET /status
```json
{
  "total_countries": 250,
  "last_refreshed_at": "2025-10-22T18:00:00Z"
}
```

## Error Handling

- `400 Bad Request` - Validation failed
- `404 Not Found` - Country not found
- `500 Internal Server Error` - Server error
- `503 Service Unavailable` - External API unavailable

## Development

- `yarn format` - Format code with Prettier
- `yarn prisma:studio` - Open Prisma Studio for database management

## Environment Variables

- `DATABASE_URL` - MySQL connection string
- `PORT` - Server port (default: 3000)