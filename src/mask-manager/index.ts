import { CustomerDocument } from "../types";
import { maskData } from "./apply-mask-rules";
import { CUSTOMER_MASK_RULES } from "./rules/customer";

export const anonymizeCustomer = (
  customer: CustomerDocument,
): CustomerDocument => maskData(customer, CUSTOMER_MASK_RULES);
