import { MaskRulesMap } from "../types";
import { maskEmail, maskText } from "../helpers";

export const CUSTOMER_MASK_RULES: MaskRulesMap = {
  firstName: maskText("firstName"),
  lastName: maskText("lastName"),
  email: maskEmail(),
  "address.line1": maskText("address.line1"),
  "address.line2": maskText("address.line2"),
  "address.postcode": maskText("address.postcode"),
};
