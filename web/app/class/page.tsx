import { permanentRedirect } from "next/navigation";

/**
 * `/class` is the shorter thing people say out loud on a call. It has never
 * been a page of its own — it is a permanent alias for `/tuesday`, so any
 * link already printed or texted keeps working and search engines consolidate
 * on one URL.
 *
 * Public, like its target: nothing here calls `auth()`.
 */
export default function ClassAliasPage(): never {
  permanentRedirect("/tuesday");
}
