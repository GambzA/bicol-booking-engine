export const AMENITY_PRESETS: { icon: string; label: string }[] = [
  { icon: 'Wifi', label: 'Wi-Fi' },
  { icon: 'Tv2', label: 'Smart TV' },
  { icon: 'Wind', label: 'Air Conditioning' },
  { icon: 'Flame', label: 'Heating' },
  { icon: 'Bath', label: 'Bathtub' },
  { icon: 'Droplets', label: 'Hot Shower' },
  { icon: 'Coffee', label: 'Coffee Maker' },
  { icon: 'Refrigerator', label: 'Mini Fridge' },
  { icon: 'Microwave', label: 'Microwave' },
  { icon: 'Utensils', label: 'Kitchenette' },
  { icon: 'Car', label: 'Free Parking' },
  { icon: 'Waves', label: 'Swimming Pool' },
  { icon: 'Dumbbell', label: 'Gym / Fitness' },
  { icon: 'Plug', label: 'Power Outlets' },
  { icon: 'Sun', label: 'Balcony / Terrace' },
  { icon: 'Phone', label: 'In-Room Phone' },
  { icon: 'Lock', label: 'In-Room Safe' },
  { icon: 'Shirt', label: 'Wardrobe / Closet' },
  { icon: 'Briefcase', label: 'Work Desk' },
  { icon: 'Eye', label: 'Scenic View' },
  { icon: 'Bus', label: 'Airport Shuttle' },
  { icon: 'Dog', label: 'Pet Friendly' },
  { icon: 'Newspaper', label: 'Daily Newspaper' },
  { icon: 'Towel', label: 'Towels Included' },
  { icon: 'CookingPot', label: 'Full Kitchen' },
  { icon: 'WashingMachine', label: 'In-Room Washer' },
  { icon: 'Wine', label: 'Minibar' },
  { icon: 'Cigarette', label: 'Smoking Allowed' },
  { icon: 'Volume2', label: 'Soundproofing' },
  { icon: 'Accessibility', label: 'Wheelchair Accessible' },
]

export const GALLERY_CATEGORIES: { key: string; label: string; icon: string }[] = [
  { key: 'room', label: 'Room Overview', icon: 'Home' },
  { key: 'beds', label: 'Beds', icon: 'BedDouble' },
  { key: 'bathroom', label: 'Bathroom', icon: 'Bath' },
  { key: 'shower', label: 'Shower', icon: 'Droplets' },
  { key: 'toilet', label: 'Toilet', icon: 'CircleDot' },
  { key: 'view', label: 'View', icon: 'Eye' },
  { key: 'living_area', label: 'Living Area', icon: 'Armchair' },
  { key: 'amenities', label: 'Amenities', icon: 'Star' },
  { key: 'exterior', label: 'Exterior', icon: 'Building2' },
  { key: 'other', label: 'Other', icon: 'MoreHorizontal' },
]

export const ACCOMMODATION_TYPES = [
  { value: 'room', label: 'Room' },
  { value: 'suite', label: 'Suite' },
  { value: 'villa', label: 'Villa' },
  { value: 'dormitory', label: 'Dormitory' },
  { value: 'cabin', label: 'Cabin' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'cottage', label: 'Cottage' },
  { value: 'tent', label: 'Tent' },
]

export const ACCOMMODATION_IMAGE_CATEGORIES = [
  { value: 'room', label: 'Room' },
  { value: 'beds', label: 'Beds' },
  { value: 'bathroom', label: 'Bathroom' },
  { value: 'shower', label: 'Shower' },
  { value: 'toilet', label: 'Toilet' },
  { value: 'view', label: 'View' },
  { value: 'living_area', label: 'Living Area' },
  { value: 'amenities', label: 'Amenities' },
  { value: 'exterior', label: 'Exterior' },
  { value: 'other', label: 'Other' },
]

export const PROPERTY_TYPES = [
  { value: 'hotel', label: 'Hotel' },
  { value: 'resort', label: 'Resort' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'hostel', label: 'Hostel' },
  { value: 'villa', label: 'Villa' },
  { value: 'bed_and_breakfast', label: 'Bed & Breakfast' },
  { value: 'guest_house', label: 'Guest House' },
]

export const CURRENCIES = [
  { value: 'PHP', label: 'PHP — Philippine Peso' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'SGD', label: 'SGD — Singapore Dollar' },
  { value: 'AUD', label: 'AUD — Australian Dollar' },
  { value: 'JPY', label: 'JPY — Japanese Yen' },
]

export const TIMEZONES = [
  { value: 'Asia/Manila', label: 'Asia/Manila (PHT +08:00)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT +08:00)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST +09:00)' },
  { value: 'Asia/Bangkok', label: 'Asia/Bangkok (ICT +07:00)' },
  { value: 'Asia/Kuala_Lumpur', label: 'Asia/Kuala_Lumpur (MYT +08:00)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEDT)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'America/New_York', label: 'America/New_York (EST/EDT)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST/PDT)' },
  { value: 'UTC', label: 'UTC' },
]

export const RATE_PLAN_PRICING_METHODS = [
  { value: 'fixed_price', label: 'Fixed Price', description: 'Set a specific rate per accommodation' },
  { value: 'fixed_amount', label: 'Fixed Amount Adjustment', description: 'Add or subtract a fixed amount from the base rate' },
  { value: 'percentage', label: 'Percentage Adjustment', description: 'Add or subtract a percentage of the base rate' },
]

export const RATE_PLAN_INCLUSIONS = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'wifi', label: 'WiFi' },
  { value: 'parking', label: 'Parking' },
  { value: 'pool_access', label: 'Pool Access' },
  { value: 'airport_shuttle', label: 'Airport Shuttle' },
  { value: 'late_checkout', label: 'Late Checkout' },
]

export const CHILD_CHARGE_TYPES = [
  { value: 'free', label: 'Free' },
  { value: 'fixed_amount', label: 'Fixed Amount (₱/night)' },
  { value: 'percentage_of_base_rate', label: '% of Base Rate' },
]

export const PACKAGE_PRICING_TYPES = [
  { value: 'per_stay', label: 'Per Stay', description: 'Flat amount added once to the booking' },
  { value: 'per_night', label: 'Per Night', description: 'Amount multiplied by the number of nights' },
  { value: 'per_person', label: 'Per Person', description: 'Amount multiplied by the total number of guests' },
]

export const PACKAGE_INCLUSIONS = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'airport_transfer', label: 'Airport Transfer' },
  { value: 'spa_access', label: 'Spa Access' },
  { value: 'island_tour', label: 'Island Tour' },
  { value: 'welcome_drink', label: 'Welcome Drink' },
  { value: 'late_checkout', label: 'Late Checkout' },
]

export const PROMOTION_DISCOUNT_TYPES = [
  { value: 'percentage', label: 'Percentage Discount', description: 'Deduct a percentage from the booking price' },
  { value: 'fixed_amount', label: 'Fixed Amount Discount', description: 'Deduct a fixed amount from the booking price' },
]

export const MAX_TAX_PERCENTAGE = 100

export const TAX_TYPES = [
  { value: 'percentage', label: 'Percentage', description: 'A percentage of the booking subtotal' },
  { value: 'fixed_amount', label: 'Fixed Amount', description: 'A flat peso amount' },
]

export const TAX_CALCULATION_METHODS = [
  { value: 'exclusive', label: 'Added to Price', description: 'Calculated and added on top of the subtotal' },
  { value: 'inclusive', label: 'Included in Price', description: 'Already part of the price; extracted for display' },
]

export const TAX_APPLICATION_SCOPES = [
  { value: 'per_booking', label: 'Per Booking', description: 'Applied once per reservation' },
  { value: 'per_night', label: 'Per Night', description: 'Applied once for each booked night' },
  { value: 'per_guest', label: 'Per Guest', description: 'Applied to every guest in the booking' },
  { value: 'per_adult', label: 'Per Adult', description: 'Applied only to adult guests' },
  { value: 'per_child', label: 'Per Child', description: 'Applied only to child guests' },
]

export const BOOKING_STATUSES = [
  { value: 'pending', label: 'Pending', color: 'amber' },
  { value: 'confirmed', label: 'Confirmed', color: 'emerald' },
  { value: 'checked_in', label: 'Checked In', color: 'blue' },
  { value: 'checked_out', label: 'Checked Out', color: 'slate' },
  { value: 'cancelled', label: 'Cancelled', color: 'red' },
  { value: 'no_show', label: 'No Show', color: 'red' },
]

export const BOOKING_PAYMENT_STATUSES = [
  { value: 'unpaid', label: 'Unpaid', color: 'red' },
  { value: 'partially_paid', label: 'Partially Paid', color: 'amber' },
  { value: 'paid', label: 'Paid', color: 'emerald' },
]

export const BOOKING_SOURCES = [
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'website', label: 'Website' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'ota', label: 'OTA' },
  { value: 'manual', label: 'Manual' },
]

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Credit/Debit Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'gcash', label: 'GCash' },
  { value: 'maya', label: 'Maya' },
  { value: 'other', label: 'Other' },
]

export const PAYMENT_METHOD_TYPES = [
  { value: 'bank_transfer', label: 'Bank Transfer', description: 'Guests pay to one of your bank accounts and upload proof' },
  { value: 'pay_at_property', label: 'Pay at Property', description: 'Guests settle on arrival, with an optional upfront deposit' },
]

export const DEPOSIT_TYPES = [
  { value: 'fixed', label: 'Fixed Amount', description: 'A flat peso deposit' },
  { value: 'percentage', label: 'Percentage', description: 'A percentage of the booking total' },
]

export const PAYMENT_RECORD_STATUSES = [
  { value: 'pending', label: 'Pending', color: 'amber' },
  { value: 'partially_paid', label: 'Partially Paid', color: 'amber' },
  { value: 'paid', label: 'Paid', color: 'emerald' },
  { value: 'failed', label: 'Failed', color: 'red' },
  { value: 'refunded', label: 'Refunded', color: 'slate' },
  { value: 'cancelled', label: 'Cancelled', color: 'slate' },
]

export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  payment_initiated: 'Payment Initiated',
  payment_authorized: 'Payment Authorized',
  payment_captured: 'Payment Captured',
  deposit_received: 'Deposit Received',
  manual_payment_recorded: 'Manual Payment Recorded',
  payment_failed: 'Payment Failed',
  payment_cancelled: 'Payment Cancelled',
  refund_initiated: 'Refund Initiated',
  refund_completed: 'Refund Completed',
  webhook_received: 'Webhook Received',
}

export const BILLABLE_ITEM_CATEGORIES = [
  { value: 'food_beverage', label: 'Food & Beverage' },
  { value: 'transportation', label: 'Transportation' },
  { value: 'accommodation_services', label: 'Accommodation Services' },
  { value: 'wellness', label: 'Wellness' },
  { value: 'housekeeping', label: 'Housekeeping' },
  { value: 'equipment_rental', label: 'Equipment Rental' },
  { value: 'fees_penalties', label: 'Fees & Penalties' },
  { value: 'miscellaneous', label: 'Miscellaneous' },
]

export const BILLABLE_ITEM_PRICING_TYPES = [
  { value: 'fixed_amount', label: 'Fixed Amount', description: 'A flat charge; quantity is up to you' },
  { value: 'per_night', label: 'Per Night', description: 'Multiplied by the number of nights' },
  { value: 'per_guest', label: 'Per Guest', description: 'Multiplied by the total number of guests' },
  { value: 'per_adult', label: 'Per Adult', description: 'Multiplied by the number of adults' },
  { value: 'per_child', label: 'Per Child', description: 'Multiplied by the number of children' },
  { value: 'per_quantity', label: 'Per Quantity', description: 'Multiplied by a quantity you specify' },
  { value: 'percentage_of_booking', label: 'Percentage of Booking', description: 'A percentage of the booking subtotal' },
]

export const QUANTITY_INPUT_PRICING_TYPES = ['fixed_amount', 'per_quantity']

export const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'fil', label: 'Filipino' },
  { value: 'ja', label: 'Japanese' },
  { value: 'zh', label: 'Chinese (Simplified)' },
  { value: 'ko', label: 'Korean' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'es', label: 'Spanish' },
]
