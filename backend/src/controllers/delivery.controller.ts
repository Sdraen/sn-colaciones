import type { RequestHandler } from "express";
import { getRequestAuth, getValidatedRequest } from "../lib/request-data.js";
import type { RecordDeliveryEventRequest } from "../schemas/delivery.schema.js";
import { recordDeliveryEvent } from "../services/delivery.service.js";

export const patchDeliveryEvent: RequestHandler = async (request, response) => {
  const { supabase } = getRequestAuth(request);
  const { params, body } = getValidatedRequest<RecordDeliveryEventRequest>(request);
  const tracking = await recordDeliveryEvent(supabase, {
    serviceDayId: params.serviceDayId,
    event: body.event,
  });
  response.status(200).json({ data: tracking });
};
