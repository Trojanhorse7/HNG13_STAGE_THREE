import express from 'express';
import {
    refreshCountries,
    getCountries,
    getCountry,
    deleteCountry,
    getStatus,
    getImage,
} from '../controllers/country.controller';

const router = express.Router();

// POST /countries/refresh
router.post('/countries/refresh', refreshCountries);

// GET /countries
router.get('/countries', getCountries);

// GET /countries/:name
router.get('/countries/:name', getCountry);

// DELETE /countries/:name
router.delete('/countries/:name', deleteCountry);

// GET /status
router.get('/status', getStatus);

// GET /countries/image
router.get('/countries/image', getImage);

export default router;
