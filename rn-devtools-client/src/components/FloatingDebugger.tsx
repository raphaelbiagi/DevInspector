import React, { useState, useRef, useEffect } from 'react'
import { View, Text, StyleSheet, PanResponder, Animated, TouchableOpacity, Dimensions } from 'react-native'
import { Bug } from 'lucide-react-native'
import { DebuggerModal } from './DebuggerModal'
import { devToolsClient } from '../DevToolsClient'
import { useDevInspectorHistory } from '../hooks/useDevInspectorHistory'

export const FloatingDebugger = () => {
  const [modalVisible, setModalVisible] = useState(false)
  const [isVisible, setIsVisible] = useState(devToolsClient.getIsVisible())
  const history = useDevInspectorHistory()
  const errorCount = history.filter(e => e.type === 'console:entry' && (e.payload as any).level === 'error').length

  useEffect(() => {
    const unsub = devToolsClient.subscribeVisibility((visible) => {
      setIsVisible(visible)
    })
    return unsub
  }, [])

  const pan = useRef(new Animated.ValueXY({ x: Dimensions.get('window').width - 70, y: Dimensions.get('window').height - 150 })).current
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2
      },
      onPanResponderGrant: () => {
        pan.extractOffset()
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        pan.flattenOffset()
      }
    })
  ).current

  if (!isVisible) return null

  return (
    <>
      <Animated.View
        style={[
          styles.floatingButton,
          { transform: [{ translateX: pan.x }, { translateY: pan.y }] }
        ]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity 
          style={styles.touchable} 
          onPress={() => setModalVisible(true)}
          activeOpacity={0.8}
        >
          <Bug color="#3B82F6" size={24} />
          {errorCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{errorCount > 9 ? '9+' : errorCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>

      <DebuggerModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </>
  )
}

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 50,
    height: 50,
    backgroundColor: '#1E1E1E',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#333'
  },
  touchable: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center'
  },
  icon: {
    fontSize: 24
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#F44336',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1E1E1E'
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold'
  }
})
