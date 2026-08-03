// Single source of truth for every legal Application.stage transition.
// Before this existed, PUT /api/applications/:id/stage only checked that the
// requested stage was *a* valid enum value — not that it was reachable from
// the application's *current* stage — so nothing stopped a request from
// jumping an application straight from "submitted" to "completed".
const APPLICATION_STAGE_GRAPH = {
  submitted: ["document_review", "rejected"],
  document_review: ["interview", "rejected"],
  interview: ["home_visit", "rejected"],
  home_visit: ["risk_assessment", "rejected"],
  risk_assessment: ["approved", "rejected"],
  approved: ["adoption_scheduled"],
  adoption_scheduled: ["completed"],
  completed: [],
  rejected: [],
};

const isValidStageTransition = (fromStage, toStage) =>
  Array.isArray(APPLICATION_STAGE_GRAPH[fromStage]) &&
  APPLICATION_STAGE_GRAPH[fromStage].includes(toStage);

module.exports = { APPLICATION_STAGE_GRAPH, isValidStageTransition };
