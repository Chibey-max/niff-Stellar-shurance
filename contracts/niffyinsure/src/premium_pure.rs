use crate::types::{PolicyType, RegionTier, PremiumQuoteLineItem};
use soroban_sdk::String;

/// Pure premium calculation module. Env-free; uses validated inputs only.
///
/// Spreadsheet parity docs:
/// - Col A: PolicyType (Auto/Health/Property) -> type_factor
/// - Col B: RegionTier (Low/Medium/High) -> region_factor  
/// - Col C: age -> age_factor
/// - Col D: risk_score (1-10) -> risk_score as i128
/// - Col E: =BASE * SUM(B:E)/10  (matches compute_premium_pure)
const BASE: i128 = 10_000_000;

#[derive(Debug, PartialEq)]
pub enum PureError {
    InvalidAge,
    InvalidRiskScore,
    ArithmeticOverflow,
    DivideByZero,
}

pub struct PremiumFactors {
    pub type_f: i128,
    pub region_f: i128,
    pub age_f: i128,
    pub risk_f: i128,
}

impl PremiumFactors {
    /// Validates and computes factors from inputs.
    /// Equivalent to spreadsheet rows.
    pub fn new(policy_type: &PolicyType, region: &RegionTier, age: u32, risk_score: u32) -> Result<Self, PureError> {
        if age == 0 || age > 120 {
            return Err(PureError::InvalidAge);
        }
        if risk_score == 0 || risk_score > 10 {
            return Err(PureError::InvalidRiskScore);
        }

        let type_f = match policy_type {
            PolicyType::Auto => 15,
            PolicyType::Health => 20,
            PolicyType::Property => 10,
        };
        let region_f = match region {
            RegionTier::Low => 8,
            RegionTier::Medium => 10,
            RegionTier::High => 14,
        };
        let age_f = if age < 25 {
            15
        } else if age > 60 {
            13
        } else {
            10
        };
        let risk_f = risk_score as i128;

        Ok(PremiumFactors { type_f, region_f, age_f, risk_f })
    }
}

pub fn compute_premium_pure(factors: &PremiumFactors) -> Result<i128, PureError> {
    let raw = factors.type_f
        .checked_add(factors.region_f)
        .ok_or(PureError::ArithmeticOverflow)?
        .checked_add(factors.age_f)
        .ok_or(PureError::ArithmeticOverflow)?
        .checked_add(factors.risk_f)
        .ok_or(PureError::ArithmeticOverflow)?;

    let product = BASE.checked_mul(raw).ok_or(PureError::ArithmeticOverflow)?;

    product.checked_div(10).ok_or(PureError::DivideByZero)?
}

pub fn build_line_items_pure(env: &soroban_sdk::Env, factors: &PremiumFactors) -> Result<Vec<PremiumQuoteLineItem>, PureError> {
    let base_type = BASE.checked_mul(factors.type_f)?.checked_div(10).ok_or(PureError::DivideByZero)?;
    let base_region = BASE.checked_mul(factors.region_f)?.checked_div(10).ok_or(PureError::DivideByZero)?;
    let base_age = BASE.checked_mul(factors.age_f)?.checked_div(10).ok_or(PureError::DivideByZero)?;
    let base_risk = BASE.checked_mul(factors.risk_f)?.checked_div(10).ok_or(PureError::DivideByZero)?;

    let mut items = Vec::new(env);
    items.push_back(PremiumQuoteLineItem {
        component: String::from_str(env, "type"),
        factor: factors.type_f,
        amount: base_type,
    });
    items.push_back(PremiumQuoteLineItem {
        component: String::from_str(env, "region"),
        factor: factors.region_f,
        amount: base_region,
    });
    items.push_back(PremiumQuoteLineItem {
        component: String::from_str(env, "age"),
        factor: factors.age_f,
        amount: base_age,
    });
    items.push_back(PremiumQuoteLineItem {
        component: String::from_str(env, "risk_score"),
        factor: factors.risk_f,
        amount: base_risk,
    });
    Ok(items)
}
