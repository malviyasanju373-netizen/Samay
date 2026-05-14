import { registerRootComponent } from 'expo';
import App from './App';

// Catch unhandled JS errors and promise rejections before React mounts
const originalHandler = ErrorUtils.getGlobalHandler();
ErrorUtils.setGlobalHandler((error, isFatal) => {
  console.error('[GLOBAL ERROR]', isFatal ? 'FATAL' : 'non-fatal', error?.message, error?.stack);
  originalHandler(error, isFatal);
});

if (typeof global !== 'undefined') {
  const anyGlobal = global as any;
  const prevRejection = anyGlobal.onunhandledrejection;
  anyGlobal.onunhandledrejection = (event: any) => {
    console.error('[UNHANDLED PROMISE REJECTION]', event?.reason);
    prevRejection?.(event);
  };
}

console.log('[index] registerRootComponent starting');
registerRootComponent(App);
console.log('[index] registerRootComponent called');
