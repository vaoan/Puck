import { loadEnv } from "@puck/config";
import pino from "pino";

export const logger = pino({ level: loadEnv().LOG_LEVEL });
