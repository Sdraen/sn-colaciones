/* global __ENV, open */

import http from "k6/http";
import exec from "k6/execution";
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";
import { Rate, Trend } from "k6/metrics";

const fixturePath =
  __ENV.LOAD_TEST_FIXTURE_PATH ?? "../../test-artifacts/k6-workers.json";
const fixtureData = new SharedArray("k6-worker-fixture", () => [
  JSON.parse(open(fixturePath)),
]);
const fixture = fixtureData[0];
const workers = fixture.workers;
const profile = (__ENV.LOAD_PROFILE ?? "smoke").toLowerCase();
const apiUrl = (__ENV.LOAD_TEST_API_URL ?? fixture.apiUrl).replace(/\/$/, "");
const normalWorkers = optionalWorkerCount(__ENV.LOAD_USERS, 100);
const menuPath = fixture.startsOn
  ? `/orders/me?startsOn=${encodeURIComponent(fixture.startsOn)}`
  : "/orders/me";

const businessFailures = new Rate("business_failures");
const menuDuration = new Trend("menu_duration", true);
const orderDuration = new Trend("order_duration", true);
const verificationDuration = new Trend("verification_duration", true);

const profileDefinitions = {
  smoke: {
    requiredWorkers: 5,
    sustained: false,
    scenario: {
      executor: "per-vu-iterations",
      vus: 5,
      iterations: 1,
      maxDuration: "2m",
    },
  },
  normal: {
    requiredWorkers: normalWorkers,
    sustained: true,
    scenario: {
      executor: "constant-vus",
      vus: normalWorkers,
      duration: "5m",
      gracefulStop: "30s",
    },
  },
  concurrent100: {
    requiredWorkers: 100,
    sustained: false,
    scenario: {
      executor: "per-vu-iterations",
      vus: 100,
      iterations: 1,
      maxDuration: "5m",
    },
  },
  stress300: {
    requiredWorkers: 300,
    sustained: true,
    scenario: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 50 },
        { duration: "1m", target: 150 },
        { duration: "2m", target: 300 },
        { duration: "5m", target: 300 },
        { duration: "1m", target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  spike300: {
    requiredWorkers: 300,
    sustained: false,
    scenario: {
      executor: "per-vu-iterations",
      vus: 300,
      iterations: 1,
      maxDuration: "5m",
    },
  },
};

const selectedProfile = profileDefinitions[profile];
if (!selectedProfile) {
  throw new Error(
    `Perfil desconocido: ${profile}. Usa smoke, normal, concurrent100, stress300 o spike300.`,
  );
}
if (workers.length < selectedProfile.requiredWorkers) {
  throw new Error(
    `El perfil ${profile} requiere ${selectedProfile.requiredWorkers} trabajadores y el fixture contiene ${workers.length}.`,
  );
}

export const options = {
  scenarios: {
    worker_orders: {
      ...selectedProfile.scenario,
      exec: "workerOrderFlow",
      tags: { profile },
    },
  },
  thresholds: {
    checks: ["rate>0.99"],
    business_failures: ["rate<0.01"],
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<2000"],
    menu_duration: [profile === "concurrent100" ? "p(95)<2500" : "p(95)<1000"],
    order_duration: ["p(95)<2000"],
    verification_duration: ["p(95)<1000"],
  },
};

export function workerOrderFlow() {
  const worker =
    workers[(exec.vu.idInTest - 1) % selectedProfile.requiredWorkers];
  const headers = {
    accept: "application/json",
    authorization: `Bearer ${worker.token}`,
    "content-type": "application/json",
  };

  const menuResponse = http.get(`${apiUrl}${menuPath}`, {
    headers,
    tags: { name: "GET /orders/me - menu" },
  });
  menuDuration.add(menuResponse.timings.duration);
  recordCheck(
    menuResponse,
    "menu disponible",
    (response) => response.status === 200,
  );

  for (const order of worker.orders) {
    const orderResponse = http.put(
      `${apiUrl}/orders/me`,
      JSON.stringify(order),
      {
        headers,
        tags: { name: "PUT /orders/me - reservar" },
      },
    );
    orderDuration.add(orderResponse.timings.duration);
    recordCheck(
      orderResponse,
      "pedido confirmado",
      (response) =>
        response.status === 200 && Boolean(response.json("data.id")),
    );
  }

  const verificationResponse = http.get(`${apiUrl}${menuPath}`, {
    headers,
    tags: { name: "GET /orders/me - verificar" },
  });
  verificationDuration.add(verificationResponse.timings.duration);
  const expectedDayIds = new Set(
    worker.orders.map((order) => order.serviceDayId),
  );
  recordCheck(verificationResponse, "pedidos guardados", (response) => {
    if (response.status !== 200) return false;
    const orders = response.json("data.orders");
    if (!Array.isArray(orders)) return false;
    const confirmed = orders.filter(
      (order) =>
        order.status === "confirmed" && expectedDayIds.has(order.serviceDayId),
    );
    return confirmed.length === expectedDayIds.size;
  });

  if (selectedProfile.sustained) {
    sleep(60 + Math.random() * 30);
  }
}

function recordCheck(response, label, predicate) {
  const passed = check(response, { [label]: predicate });
  businessFailures.add(!passed);
}

function optionalWorkerCount(value, fallback) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 300) {
    throw new Error("LOAD_USERS debe ser un entero entre 1 y 300.");
  }
  return parsed;
}
