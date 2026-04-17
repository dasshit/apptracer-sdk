import type { transportFunctionType } from "react-native-logs";
import { AppTracer } from "../sdk/AppTracer"; // или IAppTracer

export type AppTracerTransportOptions = {
  errorLevel?: string;
};

export function createAppTracerTransport(appTracer: Pick<typeof AppTracer, "addLog">) {
  const transport: transportFunctionType<AppTracerTransportOptions> = (props) => {
    const { msg, level } = props;
    appTracer.addLog({ level, timestamp: Date.now(), msg });
  };

  return transport;
}
