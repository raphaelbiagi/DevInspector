import React from 'react'
import { View } from 'react-native'

export interface IconProps {
  color?: string
  size?: number
}

/**
 * Ícone de inseto desenhado com Views do React Native.
 *
 * Existe para que o SDK não carregue nenhuma biblioteca de ícones: a UI in-app
 * usa um único ícone, e uma dependência a mais é atrito na instalação do pacote.
 */
export const BugIcon: React.FC<IconProps> = ({ color = '#3B82F6', size = 24 }) => {
  const bodyWidth = size * 0.52
  const bodyHeight = size * 0.66
  const legLength = size * 0.24
  const legThickness = Math.max(1, size * 0.07)
  const antennaLength = size * 0.2

  const leg = {
    position: 'absolute' as const,
    width: legLength,
    height: legThickness,
    borderRadius: legThickness,
    backgroundColor: color
  }

  const antenna = {
    position: 'absolute' as const,
    width: legThickness,
    height: antennaLength,
    borderRadius: legThickness,
    backgroundColor: color
  }

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Antenas */}
      <View style={[antenna, { top: 0, left: size * 0.34, transform: [{ rotate: '-25deg' }] }]} />
      <View style={[antenna, { top: 0, right: size * 0.34, transform: [{ rotate: '25deg' }] }]} />

      {/* Pernas — três pares, inclinadas para fora */}
      {[0.3, 0.46, 0.62].map((top, i) => (
        <React.Fragment key={i}>
          <View
            style={[
              leg,
              {
                top: size * top,
                left: size * 0.04,
                transform: [{ rotate: i === 0 ? '-20deg' : i === 2 ? '20deg' : '0deg' }]
              }
            ]}
          />
          <View
            style={[
              leg,
              {
                top: size * top,
                right: size * 0.04,
                transform: [{ rotate: i === 0 ? '20deg' : i === 2 ? '-20deg' : '0deg' }]
              }
            ]}
          />
        </React.Fragment>
      ))}

      {/* Corpo */}
      <View
        style={{
          width: bodyWidth,
          height: bodyHeight,
          borderRadius: bodyWidth / 2,
          borderWidth: legThickness,
          borderColor: color,
          backgroundColor: 'transparent'
        }}
      />
    </View>
  )
}
