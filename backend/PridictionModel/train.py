import argparse
import sys
import os
import json

from PridictionModel.core import run_training

def main():
    parser = argparse.ArgumentParser(description="CareMatrix AI Surge Prediction Engine Training CLI")
    parser.add_argument("--csv", type=str, help="Path to training CSV dataset file")
    parser.add_argument("--retrain", action="store_true", help="Merge with previous session CSVs and retrain")
    parser.add_argument("--climate", type=str, default="semi_arid", choices=["semi_arid", "tropical", "temperate", "cold", "equatorial"], help="Climate profile")

    args = parser.parse_args()

    print("==================================================")
    print(" CareMatrix AI Surge Engine - Model Training CLI  ")
    print("==================================================")

    try:
        stats = run_training(csv_path=args.csv, retrain=args.retrain, climate=args.climate)
        print("\n✅ Training Completed Successfully!")
        print(f"   - Total Data Rows: {stats['total_rows']}")
        print(f"   - Global Mean Patient Influx: {stats['global_mean']} / day")
        print(f"   - Best Global Regressor Model: {stats['best_global_model']}")
        print("\nModel Metrics Evaluated:")
        for m_name, m_vals in stats['evaluated_metrics'].items():
            print(f"   * {m_name:6s} -> MAE: {m_vals['mae']:5.2f} | RMSE: {m_vals['rmse']:5.2f} | R2: {m_vals['r2']:5.3f} | Acc: {m_vals['accuracy']}%")
    except Exception as e:
        print(f"\n❌ Training Failed: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
