import {AppState, Vibration} from 'react-native'
import {LOG, LOGi} from "../logging/Log";
import {Util} from "../util/Util";
const PushNotification = require('react-native-push-notification');
import {canUseIndoorLocalizationInSphere} from "../util/DataUtil";
import {eventBus} from "../util/EventBus";
import Toast from 'react-native-same-toast';
import {MessageCenter} from "../backgroundProcesses/MessageCenter";
import {MapProvider} from "../backgroundProcesses/MapProvider";


const MESSAGE_SELF_SENT_TIMEOUT = 30 * 1000; // 30 seconds

export const LocalNotifications = {
  _handleNewMessage(messageData, state) {
    if (!messageData.sphereId) {
      return;
    }

    let localSphereId = MapProvider.cloud2localMap.spheres[messageData.sphereId];
    let localLocationId = MapProvider.cloud2localMap.locations[messageData.triggerLocationId];
    if (!localSphereId) { return }

    LOG.info("LocalNotifications: received new message!", messageData);
    // do we have this sphere?
    let sphere = state.spheres[localSphereId];
    if (state && sphere) {
      // check if in the sphere
      if (sphere.config.present === true) {
        if (localLocationId) {
          // check if you're in this location or if you can't be in a location due to disabled localization
          // return if we do NOT have to deliver the message RIGHT NOW
          let canDoLocalization = canUseIndoorLocalizationInSphere(state, messageData.sphereId);
          if (canDoLocalization && Util.data.getUserLocationIdInSphere(state, messageData.sphereId, state.user.userId) !== localLocationId) {
            // we will deliver this message on moving to the other room.
            return false;
          }
        }

        let userId = state.user.userId;
        // search local messages in this sphere to see if this user has recently composed a message with this content.
        if (messageData.ownerId === userId) {
          let sphereMessageIds = Object.keys(sphere.messages);
          let now = new Date().valueOf();
          for (let i = 0; i < sphereMessageIds.length; i++) {
            let message = sphere.messages[sphereMessageIds[i]];

            if (message.config.senderId === userId && message.config.content === messageData.content) {
              LOGi.messages("Matched message!");
              if (now - message.config.updatedAt < MESSAGE_SELF_SENT_TIMEOUT || now - message.config.sentAt < MESSAGE_SELF_SENT_TIMEOUT) {
                LOGi.messages("LocalNotifications: Marking the message as delivered and read because it has been sent < 30 seconds ago:", now - message.config.sentAt, now - message.config.updatedAt)
                MessageCenter.deliveredMessage(messageData.sphereId, sphereMessageIds[i]);
                MessageCenter.readMessage(messageData.sphereId, sphereMessageIds[i]);
                return;
              }
              else {
                break;
              }
            }
          }
        }

        if (AppState.currentState !== 'active') {
          LOG.info("LocalNotifications: on the back, notify.");
          let data = { source: 'localNotification', type:'newMessage', messageId: messageData.id, sphereId: messageData.sphereId };
          // deliver message through local notification.
          PushNotification.localNotification({
            category: 'newMessage',
            tag: 'newMessage',

            data: data,
            userInfo: data,

            title: "New Message Found\n\n" + messageData.content, // (optional, for iOS this is only used in apple watch, the title will be the app name on other iOS devices)
            message: messageData.content, // (required)
            playSound: true, // (optional) default: true
            repeatType: 'minute', // (Android only) Repeating interval. Could be one of `week`, `day`, `hour`, `minute, `time`. If specified as time, it should be accompanied by one more parameter 'repeatTime` which should the number of milliseconds between each interval
            actions: '["OK"]',  // (Android only) See the doc for notification actions to know more
          });

          PushNotification.setApplicationIconBadgeNumber(1);
        }
        else {
          Toast.showWithGravity('  Message found!  ', Toast.SHORT, Toast.CENTER);
          LOG.info("LocalNotifications: on the front, just vibe.");
          // notify the user by vibration that the crownstone will be switched.
          Vibration.vibrate(200, false);
          eventBus.emit("newMessage");
        }

        return true;
      }
    }

    return false;
  }
};