import { core } from "../core";


export const Get = {

  sphere(sphereId: string) : SphereData | null {
    let state = core.store.getState();
    return state?.spheres?.[sphereId] || null;
  },

  hub(sphereId: string, hubId: string) : HubData | null {
    let sphere = Get.sphere(sphereId);
    return sphere?.hubs?.[hubId] || null;
  },

  stone(sphereId: string, stoneId: string) : StoneData | null {
    let sphere = Get.sphere(sphereId);
    return sphere?.stones?.[stoneId] || null;
  },

  location(sphereId: string, locationId: string) : LocationData | null {
    let sphere = Get.sphere(sphereId);
    return sphere?.locations?.[locationId] || null;
  }
}