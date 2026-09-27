type NodeEnvMode = 'development' | 'production' | 'test';

function getNodeEnvMode(): NodeEnvMode | undefined {
  const mode =
    process.env.NEXT_PUBLIC_NODE_ENV_MODE ?? process.env.NODE_ENV_MODE;

  if (mode === 'development' || mode === 'production' || mode === 'test') {
    return mode;
  }

  return undefined;
}

export function isDevelopmentMode(): boolean {
  return getNodeEnvMode() === 'development';
}

export function isProductionMode(): boolean {
  return getNodeEnvMode() === 'production';
}

export function isTestMode(): boolean {
  return getNodeEnvMode() === 'test';
}
