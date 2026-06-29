import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dashboardRouter from "./dashboard";
import playersRouter from "./players";
import charactersRouter from "./characters";
import guildsRouter from "./guilds";
import battlesRouter from "./battles";
import marketRouter from "./market";
import tournamentsRouter from "./tournaments";
import bossesRouter from "./bosses";
import adminRouter from "./admin";
import updateMakerRouter from "./updateMaker";
import eventsRouter from "./events";
import bugFixerRouter from "./bugFixer";
import aiEngineerRouter from "./aiEngineer";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dashboardRouter);
router.use(playersRouter);
router.use(charactersRouter);
router.use(guildsRouter);
router.use(battlesRouter);
router.use(marketRouter);
router.use(tournamentsRouter);
router.use(bossesRouter);
router.use(adminRouter);
router.use(updateMakerRouter);
router.use(eventsRouter);
router.use(bugFixerRouter);
router.use(aiEngineerRouter);

export default router;
