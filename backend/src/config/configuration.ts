import * as Joi from 'joi';

/**
 * Joi validation schema for environment variables.
 * The application will fail fast on boot if any required variable is missing.
 */
export const envValidationSchema = Joi.object({
  PORT: Joi.number().default(3000),

  MONGODB_URI: Joi.string().required().messages({
    'any.required': 'MONGODB_URI is required. Provide your MongoDB Atlas connection string.',
  }),

  FIREBASE_SERVICE_ACCOUNT: Joi.string().required().messages({
    'any.required':
      'FIREBASE_SERVICE_ACCOUNT is required. Paste the stringified Firebase service-account JSON.',
  }),

  MQTT_URL: Joi.string().required().messages({
    'any.required': 'MQTT_URL is required. Provide the MQTT broker URL (e.g. mqtts://host:8883).',
  }),

  MQTT_USERNAME: Joi.string().required().messages({
    'any.required': 'MQTT_USERNAME is required.',
  }),

  MQTT_PASSWORD: Joi.string().required().messages({
    'any.required': 'MQTT_PASSWORD is required.',
  }),
});

/**
 * Central configuration factory.
 * Values are loaded from process.env (populated by @nestjs/config + .env file).
 */
export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),

  mongodb: {
    uri: process.env.MONGODB_URI!,
  },

  firebase: {
    serviceAccount: JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT ?? '{}'),
  },

  mqtt: {
    url: process.env.MQTT_URL!,
    username: process.env.MQTT_USERNAME!,
    password: process.env.MQTT_PASSWORD!,
  },
});
