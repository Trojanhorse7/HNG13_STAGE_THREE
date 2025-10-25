import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma';
import { fetchCountries, fetchExchangeRates, generateSummaryImage } from '../utils/country.utils';
import fs from 'fs';
import path from 'path';

// Validation schema for processed country data
const processedCountrySchema = z.object({
    name: z.string().min(1),
    population: z.number().int().nonnegative(),
    currency_code: z.string().nullable(),
    capital: z.string().nullable(),
    region: z.string().nullable(),
    exchange_rate: z.number().positive().nullable(),
    estimated_gdp: z.number().nullable(),
    flag_url: z.string().nullable(),
});

export const refreshCountries = async (req: Request, res: Response) => {
    try {
        // Fetch countries
        const countriesData = await fetchCountries();
        if (!countriesData) {
            return res.status(503).json({
                error: 'External data source unavailable',
                details:
                    'Could not fetch data from https://restcountries.com/v2/all?fields=name,capital,region,population,flag,currencies',
            });
        }

        // Fetch exchange rates
        const exchangeRates = await fetchExchangeRates();
        if (!exchangeRates) {
            return res.status(503).json({
                error: 'External data source unavailable',
                details:
                    'Could not fetch data from https://open.er-api.com/v6/latest/USD',
            });
        }

        const now = new Date();

        // Process and validate countries
        const countriesToUpsert = [];
        for (const country of countriesData) {
            try {
                const currencyCode = country.currencies && country.currencies.length > 0 ? country.currencies[0].code : null;
                const exchangeRate = currencyCode && exchangeRates[currencyCode] ? exchangeRates[currencyCode] : null;
                const randomMultiplier = Math.random() * 1000 + 1000; // 1000-2000
                const estimatedGdp = exchangeRate ? (country.population * randomMultiplier) / exchangeRate : (currencyCode ? null : 0);

                const processedCountry = {
                    name: country.name,
                    capital: country.capital || null,
                    region: country.region || null,
                    population: country.population,
                    currency_code: currencyCode,
                    exchange_rate: exchangeRate,
                    estimated_gdp: estimatedGdp,
                    flag_url: country.flag || null,
                };

                // Validate the processed data
                processedCountrySchema.parse(processedCountry);
                countriesToUpsert.push({
                    ...processedCountry,
                    last_refreshed_at: now,
                });
            } catch (validationError) {
                if (validationError instanceof z.ZodError) {
                    const details: Record<string, string> = {};
                    validationError.errors.forEach((err: any) => {
                        const field = err.path[0] as string;
                        details[field] = err.message;
                    });

                    return res.status(400).json({
                        error: 'Validation failed for country data',
                        country: country.name,
                        details,
                    });
                }
                throw validationError;
            }
        }

        // Bulk replace all data in one transaction
        await prisma.$transaction([
            prisma.country.deleteMany(),
            prisma.country.createMany({ data: countriesToUpsert }), 
        ]);

        // Generate summary image
        const totalCountries = await prisma.country.count();
        const top5Gdp = await prisma.country.findMany({
            where: {
                estimated_gdp: { not: null }
            },
            orderBy: { estimated_gdp: 'desc' },
            take: 5,
            select: { name: true, estimated_gdp: true },
        });

        await generateSummaryImage(totalCountries, top5Gdp, now);

        res.json({ message: 'Countries refreshed successfully' });
    } catch (error) {
        console.error('Error refreshing countries:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Controller to get list of countries with filters that are optional
export const getCountries = async (req: Request, res: Response) => {
    try {
        const { region, currency, sort } = req.query;

        const where: any = {};
        if (region) where.region = { equals: region };
        if (currency) where.currency_code = { equals: currency };

        let orderBy: any[] = [];

        if (sort === 'gdp_desc') orderBy.push({ estimated_gdp: 'desc' });
        if (sort === 'gdp_asc') orderBy.push({ estimated_gdp: 'asc' });

        // Default sorting by name
        if (orderBy.length === 0) orderBy.push({ name: 'asc' });

        const countries = await prisma.country.findMany({
            where,
            orderBy,
        });

        res.json(countries);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Controller to get a single country by name
export const getCountry = async (req: Request, res: Response) => {
    try {
        const { name } = req.params;
        const countries = await prisma.$queryRaw<
            Array<{ id: number; name: string; capital: string | null; region: string | null; population: number; currency_code: string | null; exchange_rate: number | null; estimated_gdp: number | null; flag_url: string | null; last_refreshed_at: Date }>
        >`
        SELECT * FROM Country WHERE LOWER(name) = LOWER(${name}) LIMIT 1
        `;

        if (countries.length === 0) {
            return res.status(404).json({ error: 'Country not found' });
        }

        res.json(countries[0]);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Controller to delete a country by name
export const deleteCountry = async (req: Request, res: Response) => {
    try {
        const { name } = req.params;
        const countries = await prisma.$queryRaw<
            Array<{ id: number; name: string }>
        >`
        SELECT id, name FROM Country WHERE LOWER(name) = LOWER(${name}) LIMIT 1
        `;

        if (countries.length === 0) {
            return res.status(404).json({ error: 'Country not found' });
        }

        const country = countries[0];
        await prisma.country.delete({ where: { name: country.name } });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Controller to get status of countries data
export const getStatus = async (req: Request, res: Response) => {
    try {
        const totalCountries = await prisma.country.count();
        const last = await prisma.country.findFirst({
            orderBy: { last_refreshed_at: 'desc' },
            select: { last_refreshed_at: true },
        });

        return res.json({
            total_countries: totalCountries,
            last_refreshed_at: last
                ? last.last_refreshed_at.toISOString()
                : null,
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Controller to get summary image
export const getImage = async (req: Request, res: Response) => {
    try {
        // Check /tmp first (newer images in read-only environments), then cache
        const tmpImagePath = path.join('/tmp', 'country-api-summary.png');
        if (fs.existsSync(tmpImagePath)) {
            return res.sendFile(tmpImagePath);
        }

        // Check cache directory as fallback
        const cacheImagePath = path.join(process.cwd(), 'cache', 'summary.png');
        if (fs.existsSync(cacheImagePath)) {
            return res.sendFile(cacheImagePath);
        }

        res.status(404).json({ error: 'Summary image not found' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
