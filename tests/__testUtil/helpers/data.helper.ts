import { core } from "../../../app/ts/core";
if (core["reset"] === undefined) { throw "ERROR: mockCore should be performed before the datahelpers are imported."}

import { xUtil } from "../../../app/ts/util/StandAloneUtil";
import { Get } from "../../../app/ts/util/GetUtil";
import { MapProvider } from "../../../app/ts/backgroundProcesses/MapProvider";
import { hostname } from "os";


/**
 * These methods should be executed AFTER the mock of core.
 */

function getToken(prefix: string) {
  return prefix + "_" + xUtil.getShortUUID();
}
export function resetDataHelper() {
  lastUsedSphereId = null;
  lastUsedStoneId = null;
  stoneCount = 0;
  locationCount = 0;
}


let lastUsedSphereId = null;
let lastUsedStoneId = null;
let stoneCount = 0;
let locationCount = 0;
export function addSphere(config? : any) {
  let sphereId = 'sphere_' + xUtil.getUUID();
  if (!config) { config = {}; }
  core.store.dispatch({
    type:"ADD_SPHERE",
    sphereId: sphereId,
    data:{name: "testSphere", ...config}
  });
  MapProvider.refreshAll();
  lastUsedSphereId = sphereId;
  return Get.sphere(sphereId);
}

export function addStone(config? : any) {
  let stoneId = 'stone_' + xUtil.getUUID();
  stoneCount++;
  if (!config) { config = {}; }
  core.store.dispatch({
    type:"ADD_STONE",
    sphereId: lastUsedSphereId,
    stoneId: stoneId,
    data:{
      handle: 'handle_' + xUtil.getShortUUID(),
      name: getToken('stone'),
      crownstoneId: stoneCount,
      firmwareVersion:'5.4.0',
      ...config
    }
  });
  MapProvider.refreshAll();
  lastUsedStoneId = stoneId;

  let stone = Get.stone(lastUsedSphereId, stoneId);
  return { stone, handle: stone.config.handle };
}
export function addLocation(config? : any) {
  let locationId = 'location_' + xUtil.getUUID();
  locationCount++;
  if (!config) { config = {}; }
  core.store.dispatch({type:"ADD_LOCATION", sphereId: lastUsedSphereId, locationId: locationId, data:{name: getToken('stone'), ...config}});
  MapProvider.refreshAll();
  lastUsedStoneId = locationId;
  return Get.location(lastUsedSphereId, locationId);
}

export function createMockDatabase(meshId, meshId2?) {
  if (!meshId2) {
    meshId2 = meshId;
  }

  let sphere = addSphere();
  let location1 = addLocation();
  let location2 = addLocation();
  let location3 = addLocation();
  let location4 = addLocation();
  let stone1 = addStone({locationId: location2.id, meshNetworkId: meshId});
  let stone2 = addStone({locationId: location2.id, meshNetworkId: meshId});
  let stone3 = addStone({locationId: location3.id, meshNetworkId: meshId});
  let stone4 = addStone({locationId: location4.id, meshNetworkId: meshId});
  let stone5 = addStone({locationId: location1.id, meshNetworkId: meshId2});
  let stone6 = addStone({locationId: location1.id, meshNetworkId: meshId2});
  return {
    sphere,
    locations: [location1, location2, location3, location4],
    stones: [stone1, stone2, stone3, stone4, stone5, stone6]
  };
}