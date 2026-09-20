import { Router, type IRouter } from "express";
import healthRouter from "./health";
import vocabularyStateRouter from "./vocabulary-state";
import sentenceCheckRouter from "./sentence-check";

const router: IRouter = Router();

router.use(healthRouter);
router.use(vocabularyStateRouter);
router.use(sentenceCheckRouter);

export default router;
