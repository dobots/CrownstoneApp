type SyncCategory = 'abilities'       |
                    'behaviours'      |
                    'bootloader'      |
                    'features'        |
                    'firmware'        |
                    'hubs'            |
                    'keys'            |
                    'locations'       |
                    'messages'        |
                    'properties'      |
                    'spheres'         |
                    'scenes'          |
                    'stones'          |
                    'trackingNumbers' |
                    'toons'

interface SyncScopeMap {
  abilities?:       boolean,
  behaviours?:      boolean,
  bootloader?:      boolean,
  features?:        boolean,
  firmware?:        boolean,
  hubs?:            boolean,
  keys?:            boolean,
  locations?:       boolean,
  messages?:        boolean,
  properties?:      boolean,
  scenes?:          boolean,
  spheres?:         boolean,
  stones?:          boolean,
  trackingNumbers?: boolean,
  toons?:           boolean,
  user?:            boolean,
}

interface SyncIgnoreMap {
  abilities:       boolean,
  behaviours:      boolean,
  bootloader:      boolean,
  features:        boolean,
  firmware:        boolean,
  hubs:            boolean,
  keys:            boolean,
  locations:       boolean,
  messages:        boolean,
  properties:      boolean,
  scenes:          boolean,
  spheres:         boolean,
  stones:          boolean,
  trackingNumbers: boolean,
  toons:           boolean,
  user:            boolean,
}


interface SyncRequest {
  sync: {
    appVersion?: string,
    type: SyncType,
    lastTime?: Date | string | number,
    scope?: SyncCategory[]
  },
  user?: UpdatedAt,
  spheres?: SyncRequestSphereData
}

interface SyncRequestSphereData {
  [sphereId: string]: {
    data?: UpdatedAt,
    hubs?: {
      [hubId: string]: RequestItemCoreType
    },
    features?: {
      [featureId: string]: RequestItemCoreType
    }
    locations?: {
      [locationId: string]: RequestItemCoreType
    },
    messages?:  {
      [messageId: string]: RequestItemCoreType
    },
    scenes?: {
      [sceneId: string]: RequestItemCoreType
    },
    stones?: {
      [stoneId: string]: SyncRequestStoneData
    },
    trackingNumbers?: {
      [trackingNumberId: string]: RequestItemCoreType
    }
    toons?: {
      [toonId: string]: RequestItemCoreType
    }
  }
}

interface SyncRequestStoneData {
  new?: boolean,
  data: UpdatedAt,
  abilities?:  {
    [abilityId:string]: {
      new?: boolean,
      data: UpdatedAt
      properties?: {
        [propertyId:string]: RequestItemCoreType
      }
    }
  },
  behaviours?: {
    [behaviourId: string]: RequestItemCoreType
  }
}

interface RequestItemCoreType {
  new?: boolean,
  data: UpdatedAt
}
interface UpdatedAt {
  [key: string]: any
  updatedAt: string
}

type SyncType  = "FULL"    |  // will just get your spheres and user.
                 "REQUEST" |  // initial phase of sync
                 "REPLY";     // wrap up phase of sync where the user will give the cloud ...
                              //  ... any data that the cloud has requested with REQUEST_DATA (optional)

type SyncState = "NOT_AVAILABLE" |  // this entity does not exist on the cloud or you dont have access to it.
                       "IN_SYNC" |  // same updatedAt time
                         "ERROR" |  // something went wrong (HAS ERROR)
            "NEW_DATA_AVAILABLE" |  // cloud has newer data (HAS DATA)
                  "REQUEST_DATA" |  // you have newer data, please give to cloud.
              "UPDATED_IN_CLOUD" |  // the cloud has been updated with your model
              "CREATED_IN_CLOUD" |  // the cloud has an additional id other than what you requested
                 "ACCESS_DENIED" |  // user has no permission to create/delete something.
                          "VIEW"    // you have requested data, here it is. No syncing information. (HAS DATA)


interface SyncError {
  code: number,
  msg: string
}



interface SyncRequestResponse {
  user?: SyncResponseItemCore<cloud_User>,
  spheres: {
    [sphereId: string]: SyncRequestResponse_Sphere
  },
  firmwares?:   { status: SyncState, [hardwareVersion: string] : any },
  bootloaders?: { status: SyncState, [hardwareVersion: string] : any },
  keys?:        { },
}

interface SyncRequestResponse_Sphere {
  data?: SyncResponseItemCore<cloud_Sphere>,
  hubs?: {
    [hubId: string]: {
      data: SyncResponseItemCore<cloud_Hub>,
    }
  },
  features?: {
    [featureId: string] : {
      data: SyncResponseItemCore<cloud_SphereFeature>
    }
  },
  locations?: {
    [locationId: string]: {
      data: SyncResponseItemCore<cloud_Location>,
    }
  },
  messages?:  {
    [messageId: string] : {
      data: SyncResponseItemCore<cloud_Message>
    }
  },
  scenes?:  {
    [sceneId: string] : {
      data: SyncResponseItemCore<cloud_Scene>
    }
  },
  stones?: {
    [stoneId: string]: SyncResponseStone,
  },
  trackingNumbers?: {
    [trackingNumberId: string] : {
      data: SyncResponseItemCore<cloud_SphereTrackingNumber>
    }
  }
  toons?:  {
    [toonId: string] : {
      data: SyncResponseItemCore<cloud_Toon>
    }
  },
}

interface SyncResponseItemCore<T extends Entity> {
  status: SyncState,
  data?: T,
  error?: SyncError
}

interface SyncResponseStone {
  data?: SyncResponseItemCore<cloud_Stone>,
  abilities?: {
    [abilityId:string]: {
      data: SyncResponseItemCore<cloud_Ability>
      properties?: {
        [propertyId:string]: {
          data: SyncResponseItemCore<cloud_AbilityProperty>
        }
      }
    }
  },
  behaviours?: {
    [behaviourId:string]: {
      data: SyncResponseItemCore<cloud_Behaviour>
    }
  },
}


type UserKeySet = UserKeys[]
interface UserKeys {
  sphereId: string,
  sphereAuthorizationToken: string,
  sphereKeys: cloud_SphereKey[]
  stoneKeys: {[stoneId: string] : cloud_StoneKey[]}
}
