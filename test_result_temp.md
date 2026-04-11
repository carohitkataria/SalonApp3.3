## user_problem_statement: |
  Multi-User RBAC for Salon Management with:
  - P0 CRITICAL FIX: Frontend crash due to missing useNavigate import in BarberManagement  
  - Custom Package Summation in Customer Master  
  - Loyalty Program with auto wallet top-up  

## backend:
  - task: "Loyalty auto top-up on booking completion"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py (line 620-672, 2940-2979)"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
        - agent: "main"
        - comment: "Implemented check_and_apply_loyalty_reward() helper and integrated into complete_token(). Needs testing."

  - task: "Loyalty program settings endpoints"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py (line 2616-2647)"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
        - agent: "main"
        - comment: "GET /api/salons/{salon_id}/loyalty-program and POST /api/salons/{salon_id}/loyalty-program already exist. Needs testing."

## frontend:
  - task: "Fix missing useNavigate import in BarberManagement"
    implemented: true
    working: true
    file: "/app/frontend/src/components/BarberManagement.js"
    stuck_count: 0
    priority: "critical"
    needs_retesting: false
    status_history:
        - working: true
        - agent: "main"
        - comment: "Added missing import, removed duplicate code, added missing constants. App loads successfully now."

  - task: "Custom Package Summation UI"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/components/CustomerMaster.js (line 369-383)"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
        - working: "NA"
        - agent: "main"
        - comment: "Already implemented - shows original total, discount, and final price. Needs UI verification."

  - task: "Loyalty Program Settings UI"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/components/LoyaltyProgramSettings.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
        - agent: "main"
        - comment: "New component created with enable/disable toggle, spend threshold, period, top-up %. Integrated into MembershipManagement. Needs full testing."

## metadata:
  created_by: "main_agent"
  version: "2.0"
  test_sequence: 1
  run_ui: true

## test_plan:
  - Test loyalty program configuration save/load
  - Test auto top-up on booking completion  
  - Test custom package summation calculation
  - Test Staff Management section loads without crash

## test_credentials:
  - salon_phone: "+919876543210"
  - salon_password: "salon123"  # May not work, try OTP
  - test_user_phone: "+919999999999"

