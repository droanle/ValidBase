import "reflect-metadata";
import {config as dotenv} from "dotenv";
import express, {Application} from "express";
import init from "./src";

dotenv();

const app: Application = express();

init(app);

export {app};