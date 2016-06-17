import React, { Component } from 'react'
import {
  Animated,
  Alert,
  Image,
  StyleSheet,
  TouchableHighlight,
  TouchableOpacity,
  Text,
  View
} from 'react-native';
var Actions = require('react-native-router-flux').Actions;

import { IconCircle } from '../components/IconCircle'
import { NativeBridge } from '../../native/NativeBridge'
import { Background } from '../components/Background'
import { colors, width, height } from '../styles'
var Icon = require('react-native-vector-icons/Ionicons');


export class SetupTrainRoom extends Component {
  constructor(props) {
    super();
    this.state = {text:'initializing', active: false, opacity: new Animated.Value(0)};
    this.collectedData = [];
    this.dataLimit = 30;
  }

  componentDidMount() {
    this.start()
  }

  componentWillUnmount() {
    this.stop()
  }

  start() {
    this.collectedData = [];
    this.setState({text:'initializing', active:true});
    NativeBridge.startFingerprinting(this.handleCollection.bind(this))
  }

  stop() {
    if (this.state.active === true) {
      NativeBridge.abortFingerprinting();
      this.collectedData = [];
      this.setState({active: false});
    }
  }

  handleCollection(data) {
    this.collectedData.push(data);
    this.setState({text: Math.round((this.collectedData.length/this.dataLimit)*100) + ' %'});
    this.animatePulse();

    if (this.collectedData.length == this.dataLimit) {
      this.setState({text:'Finished!', active:false});
      const store = this.props.store;
      const state = store.getState();
      let groupId = state.app.activeGroup;
      NativeBridge.finalizeFingerprint(groupId, this.props.locationId);
      NativeBridge.getFingerprint(groupId, this.props.locationId)
        .then((result) => {
          console.log("gathered fingerprint:", result);
          store.dispatch({
            type:'UPDATE_LOCATION_FINGERPRINT',
            groupId: groupId,
            locationId: this.props.locationId,
            data:{ fingerprintRaw: result }})
        })

    }
  }

  animatePulse() {
    Animated.timing(this.state.opacity, {toValue: 1, duration:80}).start();
    setTimeout(() => {Animated.timing(this.state.opacity, {toValue: 0, duration:450}).start();},80);
  }

  render() {
    return (
      <Background background={require('../../images/mainBackgroundLight.png')}>
        <View style={{flexDirection:'column', flex:1}}>
          <View style={{padding:30, alignItems:'center'}}>
              <Text style={{
                backgroundColor:'transparent',
                fontSize:20,
                fontWeight:'600',
                color: colors.menuBackground.h,
                textAlign:'center'
              }}>Walk around the room so it can learn to locate you within it. Each beat a point is collected.</Text>
          </View>
          { this.state.active === true ?
          <View style={{flex:1, alignItems:'center', justifyContent:'center'}} >
            <View style={{position:'relative'}}>
              <View><Icon name="ios-pin" size={140} style={{color:'#fff', backgroundColor:'transparent'}} /></View>
              <Animated.View style={{ opacity:this.state.opacity }}>
                <Icon name="ios-pin" size={140} style={{marginTop:-153, color: colors.green.h, backgroundColor:'transparent'}} />
              </Animated.View>
            </View>
          </View>
            :  <View style={{flex:1}} /> }
          <View style={{flexDirection:'row'}}>
            <View style={{flex:1}} />
            <View style={{backgroundColor:'rgba(255,255,255,1)', width:0.5*width, padding:10, alignItems:'center', borderRadius:30}}>
              <Text style={{backgroundColor:'transparent', fontSize:22, fontWeight:'200'}}>{this.state.text}</Text>
            </View>
            <View style={{flex:1}} />
          </View>
          <View style={{flex:1}} />
          <View style={{flexDirection:'row', position:'absolute', bottom:10, width: width}}>
            <View style={{flex:1}} />
            {this.state.active ?
              <TouchableOpacity onPress={() => {this.stop();}}>
                <IconCircle icon="md-hand" color="#fff" backgroundColor={colors.red.h} size={90}/>
              </TouchableOpacity>
            :
              <TouchableOpacity onPress={() => {this.start();}}>
                <IconCircle icon="ios-mic" color="#fff" backgroundColor={colors.green.h} size={90}/>
              </TouchableOpacity>
            }
            <View style={{flex:1}} />
          </View>
        </View>
      </Background>
    );

  }
}