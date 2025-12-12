import React from "react";

export function Th(
  props: React.PropsWithChildren<{
    className?: string;
    onClick?: () => void;
  }>
) {
  return (
    <th
      className={
        "px-4 py-2 text-left text-[11px] font-medium uppercase tracking-[0.18em] " +
        (props.className ?? "")
      }
      onClick={props.onClick}
    >
      {props.children}
    </th>
  );
}

export function Td(
  props: React.PropsWithChildren<{
    className?: string;
    colSpan?: number;
  }>
) {
  return (
    <td
      className={
        "px-4 py-2 align-middle text-[13px] text-slate-200 " +
        (props.className ?? "")
      }
      colSpan={props.colSpan}
    >
      {props.children}
    </td>
  );
}
