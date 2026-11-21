// @nestjs/observe ships ESM only, which Jest's CommonJS runtime cannot load. Tests never report, so a no-op stands in.
import { Module } from '@nestjs/common';

@Module({})
class NoopObserveModule {
  static forRootAsync() {
    return { module: NoopObserveModule };
  }
}

export const createObserveModule = () => ({ ObserveModule: NoopObserveModule, ObserveInstrument: undefined });
