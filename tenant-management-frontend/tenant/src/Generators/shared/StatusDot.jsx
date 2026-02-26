import { GEN_STATUS_STYLE } from "../constants/constant";

export function StatusDot({ status }) {
    const style = GEN_STATUS_STYLE[status] || GEN_STATUS_STYLE.IDLE;
    return <span className={`inline-block w-2 h-2 rounded-full ${style.dot}`} />;
}