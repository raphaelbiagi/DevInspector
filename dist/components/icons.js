import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { View } from 'react-native';
/**
 * Ícone de inseto desenhado com Views do React Native.
 *
 * Existe para que o SDK não carregue nenhuma biblioteca de ícones: a UI in-app
 * usa um único ícone, e uma dependência a mais é atrito na instalação do pacote.
 */
export const BugIcon = ({ color = '#3B82F6', size = 24 }) => {
    const bodyWidth = size * 0.52;
    const bodyHeight = size * 0.66;
    const legLength = size * 0.24;
    const legThickness = Math.max(1, size * 0.07);
    const antennaLength = size * 0.2;
    const leg = {
        position: 'absolute',
        width: legLength,
        height: legThickness,
        borderRadius: legThickness,
        backgroundColor: color
    };
    const antenna = {
        position: 'absolute',
        width: legThickness,
        height: antennaLength,
        borderRadius: legThickness,
        backgroundColor: color
    };
    return (_jsxs(View, { style: { width: size, height: size, alignItems: 'center', justifyContent: 'center' }, children: [_jsx(View, { style: [antenna, { top: 0, left: size * 0.34, transform: [{ rotate: '-25deg' }] }] }), _jsx(View, { style: [antenna, { top: 0, right: size * 0.34, transform: [{ rotate: '25deg' }] }] }), [0.3, 0.46, 0.62].map((top, i) => (_jsxs(React.Fragment, { children: [_jsx(View, { style: [
                            leg,
                            {
                                top: size * top,
                                left: size * 0.04,
                                transform: [{ rotate: i === 0 ? '-20deg' : i === 2 ? '20deg' : '0deg' }]
                            }
                        ] }), _jsx(View, { style: [
                            leg,
                            {
                                top: size * top,
                                right: size * 0.04,
                                transform: [{ rotate: i === 0 ? '20deg' : i === 2 ? '-20deg' : '0deg' }]
                            }
                        ] })] }, i))), _jsx(View, { style: {
                    width: bodyWidth,
                    height: bodyHeight,
                    borderRadius: bodyWidth / 2,
                    borderWidth: legThickness,
                    borderColor: color,
                    backgroundColor: 'transparent'
                } })] }));
};
//# sourceMappingURL=icons.js.map