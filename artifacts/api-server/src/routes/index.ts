import { Router, type IRouter } from "express";
import healthRouter from "./health";
import vocabularyStateRouter from "./vocabulary-state";
import sentenceCheckRouter from "./sentence-check";
import wordRecommendationsRouter from "./word-recommendations";
import dictionaryRouter from "./dictionary";

const router: IRouter = Router();

router.use(healthRouter);
router.use(vocabularyStateRouter);
router.use(sentenceCheckRouter);
router.use(wordRecommendationsRouter);
router.use(dictionaryRouter);

export default router;
