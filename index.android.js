'use strict';
import React, { Component } from 'react'
import {
  Animated,
  Alert,
  AppRegistry,
  BackAndroid,
  Keyboard,
  StatusBar,
  View
} from 'react-native';

import { AppRouter } from './js/router/Router'
import { eventBus } from './js/util/eventBus'
import { quitApp } from './js/util/util'
import { INITIALIZER } from './js/initialize'
import { colors, screenWidth, screenHeight } from './js/views/styles'


//import SplashScreen from "rn-splash-screen";

class Root extends Component {
  constructor() {
    super();
    this.state = {top: new Animated.Value(0)};
    this.unsubscribe = [];
  }

  // this is used to scroll the view up when typing is active
  componentDidMount() {
    // SplashScreen.hide();

    // start the BLE things.
    INITIALIZER.init();

    // avoid closing the app by tapping back too often.
    BackAndroid.addEventListener('hardwareBackPress', () => {
      Alert.alert("Would you like to close the app?", "The app will still run in the background, this is required for your Crownstones to respond to you. Choose \"Force quit\" to stop running completely.",[
        {text:'Force quit', onPress: () => { quitApp(); }},
        {text:'Cancel'},
        {text:'Ok', onPress: () => { BackAndroid.exitApp(); }}
      ]);

      // if the user presses back the second time, we close the app
      return true;
    });

  }

  componentWillUnmount() {
    this.unsubscribe.forEach((callback) => {callback()});
    this.unsubscribe = [];
    this.keyboardDidHideListener.remove();
  }


  render() {
    StatusBar.setBackgroundColor('#00162C', true);
    return <View style={{flex:1}}>
      <Animated.View style={{flex:1, position:'relative', top: this.state.top}}>
        <AppRouter />
      </Animated.View>
    </View>
  };
}



AppRegistry.registerComponent('Crownstone', () => Root);