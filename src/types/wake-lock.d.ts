// Wake Lock API type augmentation
interface WakeLockSentinel extends EventTarget {
  released: boolean;
  type: WakeLockType;
  release(): Promise<void>;
}

interface WakeLock {
  request(type: WakeLockType): Promise<WakeLockSentinel>;
}

type WakeLockType = 'screen';

interface Navigator {
  wakeLock?: WakeLock;
}
