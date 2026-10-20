import React from 'react';
export interface IconProps {
    color?: string;
    size?: number;
}
/**
 * Ícone de inseto desenhado com Views do React Native.
 *
 * Existe para que o SDK não carregue nenhuma biblioteca de ícones: a UI in-app
 * usa um único ícone, e uma dependência a mais é atrito na instalação do pacote.
 */
export declare const BugIcon: React.FC<IconProps>;
