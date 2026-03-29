import { Router } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { listCountryCurrencyOptions } from "./country-currency.service.js";

const metadataRouter = Router();

metadataRouter.get(
  "/countries",
  asyncHandler(async (req, res) => {
    const refreshRequested = req.query.refresh === "true";
    const countries = await listCountryCurrencyOptions(refreshRequested);

    res.json({
      success: true,
      data: countries
    });
  })
);

export { metadataRouter };
